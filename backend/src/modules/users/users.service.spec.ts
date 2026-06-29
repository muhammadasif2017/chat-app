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
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(fakeUser()),
    },
  } as unknown as import('../../infra/prisma/prisma.service.js').PrismaService;
}

type FakePrisma = ReturnType<typeof makePrisma>;

function makeService(prisma: FakePrisma = makePrisma()) {
  return { svc: new UsersService(prisma), prisma };
}

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
