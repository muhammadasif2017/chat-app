import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';

const USER_ID = 'user-uuid';
const OTHER_ID = 'other-uuid';

function fakeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    username: 'alice',
    email: 'alice@example.com',
    avatarUrl: null,
    lastSeenAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makePrisma() {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(fakeUser()),
      update: jest.fn().mockResolvedValue(fakeUser()),
    },
  } as unknown as import('../../infra/prisma/prisma.service.js').PrismaService;
}

type FakePrisma = ReturnType<typeof makePrisma>;

function makeService(prisma: FakePrisma = makePrisma()) {
  return { svc: new UsersService(prisma), prisma };
}

describe('UsersService.findByEmailWithPassword', () => {
  it('queries by the provided email', async () => {
    const { svc, prisma } = makeService();

    await svc.findByEmailWithPassword('alice@example.com');

    const call = (prisma.user.findUnique as jest.Mock).mock.calls[0] as [
      { where: { email: string }; select?: unknown },
    ];
    expect(call[0].where.email).toBe('alice@example.com');
  });

  it('does not restrict the select, so the password hash is returned', async () => {
    const { svc, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(fakeUser({ password: 'hashed' }));

    const result = await svc.findByEmailWithPassword('alice@example.com');

    const call = (prisma.user.findUnique as jest.Mock).mock.calls[0] as [{ select?: unknown }];
    expect(call[0].select).toBeUndefined();
    expect(result).toHaveProperty('password');
  });

  it('returns null when no user matches', async () => {
    const { svc } = makeService();

    const result = await svc.findByEmailWithPassword('nobody@example.com');

    expect(result).toBeNull();
  });
});

describe('UsersService.findByEmailOrUsername', () => {
  it('matches on either email or username', async () => {
    const { svc, prisma } = makeService();

    await svc.findByEmailOrUsername('alice@example.com', 'alice');

    const call = (prisma.user.findFirst as jest.Mock).mock.calls[0] as [
      { where: { OR: Array<{ email?: string; username?: string }> } },
    ];
    expect(call[0].where.OR).toEqual([{ email: 'alice@example.com' }, { username: 'alice' }]);
  });

  it('returns null when neither matches', async () => {
    const { svc } = makeService();

    const result = await svc.findByEmailOrUsername('new@example.com', 'newuser');

    expect(result).toBeNull();
  });
});

describe('UsersService.create', () => {
  it('passes the provided fields to prisma create', async () => {
    const { svc, prisma } = makeService();
    const data = { username: 'alice', email: 'alice@example.com', password: 'hashed' };

    await svc.create(data);

    const call = (prisma.user.create as jest.Mock).mock.calls[0] as [{ data: typeof data }];
    expect(call[0].data).toEqual(data);
  });

  it('returns the created user', async () => {
    const { svc, prisma } = makeService();
    const created = fakeUser();
    (prisma.user.create as jest.Mock).mockResolvedValue(created);

    const result = await svc.create({
      username: 'alice',
      email: 'alice@example.com',
      password: 'hashed',
    });

    expect(result).toEqual(created);
  });
});

describe('UsersService.findPublicById', () => {
  it('queries by the provided userId', async () => {
    const { svc, prisma } = makeService();

    await svc.findPublicById(USER_ID);

    const call = (prisma.user.findUnique as jest.Mock).mock.calls[0] as [{ where: { id: string } }];
    expect(call[0].where.id).toBe(USER_ID);
  });

  it('selects a public field set that excludes the password', async () => {
    const { svc, prisma } = makeService();

    await svc.findPublicById(USER_ID);

    const call = (prisma.user.findUnique as jest.Mock).mock.calls[0] as [
      { select: Record<string, boolean> },
    ];
    expect(call[0].select).not.toHaveProperty('password');
    expect(call[0].select).toMatchObject({
      id: true,
      username: true,
      email: true,
      avatarUrl: true,
    });
  });

  it('returns null when no user matches', async () => {
    const { svc } = makeService();

    const result = await svc.findPublicById(USER_ID);

    expect(result).toBeNull();
  });
});

describe('UsersService.getProfile', () => {
  it('returns user when found', async () => {
    const { svc, prisma } = makeService();
    const user = fakeUser();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

    const result = await svc.getProfile(USER_ID);

    expect(result).toEqual(user);
  });

  it('throws NotFoundException when user does not exist', async () => {
    const { svc } = makeService();

    await expect(svc.getProfile(USER_ID)).rejects.toThrow(NotFoundException);
  });

  it('queries by the provided userId', async () => {
    const { svc, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(fakeUser());

    await svc.getProfile(USER_ID);

    const call = (prisma.user.findUnique as jest.Mock).mock.calls[0] as [{ where: { id: string } }];
    expect(call[0].where.id).toBe(USER_ID);
  });
});

describe('UsersService.updateProfile', () => {
  it('passes dto fields to prisma update', async () => {
    const { svc, prisma } = makeService();
    (prisma.user.update as jest.Mock).mockResolvedValue(fakeUser({ username: 'bob' }));

    await svc.updateProfile(USER_ID, { username: 'bob' });

    const call = (prisma.user.update as jest.Mock).mock.calls[0] as [
      { where: { id: string }; data: { username?: string } },
    ];
    expect(call[0].where.id).toBe(USER_ID);
    expect(call[0].data.username).toBe('bob');
  });

  it('returns updated user', async () => {
    const { svc, prisma } = makeService();
    const updated = fakeUser({ avatarUrl: 'https://example.com/avatar.png' });
    (prisma.user.update as jest.Mock).mockResolvedValue(updated);

    const result = await svc.updateProfile(USER_ID, {
      avatarUrl: 'https://example.com/avatar.png',
    });

    expect(result.avatarUrl).toBe('https://example.com/avatar.png');
  });
});

describe('UsersService.search', () => {
  it('excludes the requesting user from results', async () => {
    const { svc, prisma } = makeService();
    (prisma.user.findMany as jest.Mock).mockResolvedValue([fakeUser({ id: OTHER_ID })]);

    await svc.search('alice', USER_ID);

    const call = (prisma.user.findMany as jest.Mock).mock.calls[0] as [
      { where: { id: { not: string } } },
    ];
    expect(call[0].where.id.not).toBe(USER_ID);
  });

  it('returns array of matching users', async () => {
    const { svc, prisma } = makeService();
    const users = [fakeUser({ id: OTHER_ID })];
    (prisma.user.findMany as jest.Mock).mockResolvedValue(users);

    const result = await svc.search('al', USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(OTHER_ID);
  });

  it('returns empty array when no matches', async () => {
    const { svc } = makeService();

    const result = await svc.search('zzz', USER_ID);

    expect(result).toEqual([]);
  });
});
