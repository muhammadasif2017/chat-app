import { PresenceService } from './presence.service';

const USER_ID = 'user-uuid';
const SOCKET_ID = 'socket-uuid';
const CONV_ID = 'conv-uuid';

function makePipeline(results: Array<[null, number]> = []) {
  return {
    exists: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(results),
  };
}

function makeRedis(pipelineResults: Array<[null, number]> = []) {
  return {
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    pipeline: jest.fn(() => makePipeline(pipelineResults)),
  };
}

function makePrisma() {
  return {
    user: { update: jest.fn().mockResolvedValue({}) },
  };
}

function makeService(redisOverrides = {}, prismaOverrides = {}) {
  const redis = { ...makeRedis(), ...redisOverrides } as any;
  const prisma = { ...makePrisma(), ...prismaOverrides } as any;
  return { svc: new PresenceService(redis, prisma), redis, prisma };
}

describe('PresenceService.setOnline', () => {
  it('writes presence key with TTL=30 and JSON payload', async () => {
    const { svc, redis } = makeService();
    await svc.setOnline(USER_ID, SOCKET_ID);
    expect(redis.set).toHaveBeenCalledWith(
      `presence:${USER_ID}`,
      JSON.stringify({ socketId: SOCKET_ID }),
      'EX',
      30,
    );
  });
});

describe('PresenceService.setOffline', () => {
  it('deletes presence key and updates lastSeenAt', async () => {
    const { svc, redis, prisma } = makeService();
    await svc.setOffline(USER_ID);
    expect(redis.del).toHaveBeenCalledWith(`presence:${USER_ID}`);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID } }),
    );
  });

  it('sets lastSeenAt to a recent timestamp', async () => {
    const before = Date.now();
    const { svc, prisma } = makeService();
    await svc.setOffline(USER_ID);
    const after = Date.now();
    const ts: Date = prisma.user.update.mock.calls[0][0].data.lastSeenAt;
    expect(ts.getTime()).toBeGreaterThanOrEqual(before);
    expect(ts.getTime()).toBeLessThanOrEqual(after);
  });
});

describe('PresenceService.refreshHeartbeat', () => {
  it('resets TTL=30 on presence key', async () => {
    const { svc, redis } = makeService();
    await svc.refreshHeartbeat(USER_ID);
    expect(redis.expire).toHaveBeenCalledWith(`presence:${USER_ID}`, 30);
  });
});

describe('PresenceService.getPresence', () => {
  it('returns empty Map for empty input without calling Redis', async () => {
    const { svc, redis } = makeService();
    const result = await svc.getPresence([]);
    expect(result.size).toBe(0);
    expect(redis.pipeline).not.toHaveBeenCalled();
  });

  it('returns true for users with presence key (EXISTS=1)', async () => {
    const pipelineResults: Array<[null, number]> = [
      [null, 1],
      [null, 0],
    ];
    const { svc } = makeService({ pipeline: jest.fn(() => makePipeline(pipelineResults)) });
    const result = await svc.getPresence(['user-a', 'user-b']);
    expect(result.get('user-a')).toBe(true);
    expect(result.get('user-b')).toBe(false);
  });

  it('queues one EXISTS call per userId', async () => {
    const pipeline = makePipeline([
      [null, 1],
      [null, 1],
    ]);
    const { svc } = makeService({ pipeline: jest.fn(() => pipeline) });
    await svc.getPresence(['user-a', 'user-b']);
    expect(pipeline.exists).toHaveBeenCalledTimes(2);
    expect(pipeline.exists).toHaveBeenCalledWith('presence:user-a');
    expect(pipeline.exists).toHaveBeenCalledWith('presence:user-b');
  });

  it('treats null pipeline result as offline', async () => {
    const { svc } = makeService({ pipeline: jest.fn(() => makePipeline([[null, 0]])) });
    const result = await svc.getPresence([USER_ID]);
    expect(result.get(USER_ID)).toBe(false);
  });
});

describe('PresenceService.setTyping', () => {
  it('writes typing key with TTL=3', async () => {
    const { svc, redis } = makeService();
    await svc.setTyping(CONV_ID, USER_ID);
    expect(redis.set).toHaveBeenCalledWith(`typing:${CONV_ID}:${USER_ID}`, '1', 'EX', 3);
  });
});

describe('PresenceService.clearTyping', () => {
  it('deletes typing key', async () => {
    const { svc, redis } = makeService();
    await svc.clearTyping(CONV_ID, USER_ID);
    expect(redis.del).toHaveBeenCalledWith(`typing:${CONV_ID}:${USER_ID}`);
  });
});
