import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';

jest.mock('bcrypt', () => {
  const real = jest.requireActual<typeof import('bcrypt')>('bcrypt');
  return { ...real, compare: jest.fn().mockImplementation(real.compare) };
});

const USER_ID = 'user-uuid';
const EMAIL = 'user@example.com';
const RAW_PASSWORD = 'hunter2';
const JTI = 'jti-uuid';

function makePrisma() {
  return {
    refreshToken: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
  } as unknown as import('../../infra/prisma/prisma.service.js').PrismaService;
}

type FakePrisma = ReturnType<typeof makePrisma>;

function makeUsers() {
  return {
    findByEmailWithPassword: jest.fn().mockResolvedValue(null),
    findByEmailOrUsername: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    findPublicById: jest.fn().mockResolvedValue(null),
  } as unknown as import('../users/users.service.js').UsersService;
}

type FakeUsers = ReturnType<typeof makeUsers>;

function makeJwt() {
  return {
    signAsync: jest.fn().mockResolvedValue('signed-token'),
  } as unknown as JwtService;
}

function makeConfig() {
  const env: Record<string, string> = {
    JWT_SECRET: 'secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };
  return { get: (k: string) => env[k] } as unknown as import('@nestjs/config').ConfigService;
}

async function makeService(prisma: FakePrisma = makePrisma(), users: FakeUsers = makeUsers()) {
  const svc = new AuthService(prisma, users, makeJwt(), makeConfig());
  await svc.onModuleInit();
  return { svc, prisma, users };
}

describe('AuthService.register', () => {
  it('throws BadRequestException when email already exists', async () => {
    const { svc, users } = await makeService();
    (users.findByEmailOrUsername as jest.Mock).mockResolvedValue({
      id: USER_ID,
      email: EMAIL,
      username: 'taken',
    });

    await expect(
      svc.register({ username: 'newuser', email: EMAIL, password: RAW_PASSWORD }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when username already exists', async () => {
    const { svc, users } = await makeService();
    (users.findByEmailOrUsername as jest.Mock).mockResolvedValue({
      id: USER_ID,
      email: 'other@example.com',
      username: 'taken',
    });

    await expect(
      svc.register({ username: 'taken', email: 'new@example.com', password: RAW_PASSWORD }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns user without password field', async () => {
    const { svc, users } = await makeService();
    (users.create as jest.Mock).mockResolvedValue({
      id: USER_ID,
      username: 'alice',
      email: EMAIL,
      password: 'hashed',
      avatarUrl: null,
    });

    const result = await svc.register({ username: 'alice', email: EMAIL, password: RAW_PASSWORD });

    expect(result.user).not.toHaveProperty('password');
    expect(result.user.email).toBe(EMAIL);
  });

  it('stores a bcrypt hash, not the raw password', async () => {
    const { svc, users } = await makeService();
    (users.create as jest.Mock).mockImplementation((data) =>
      Promise.resolve({ id: USER_ID, ...data, avatarUrl: null }),
    );

    await svc.register({ username: 'alice', email: EMAIL, password: RAW_PASSWORD });

    const createArg = ((users.create as jest.Mock).mock.calls[0] as [{ password: string }])[0];
    expect(createArg.password).not.toBe(RAW_PASSWORD);
    const isHashed = await bcrypt.compare(RAW_PASSWORD, createArg.password);
    expect(isHashed).toBe(true);
  });
});

describe('AuthService.validateLocalUser', () => {
  it('returns null when user does not exist', async () => {
    const { svc } = await makeService();
    const result = await svc.validateLocalUser(EMAIL, RAW_PASSWORD);
    expect(result).toBeNull();
  });

  it('initializes dummyHash as a bcrypt hash so compare always runs (timing-attack guard)', async () => {
    const { svc } = await makeService();
    const hash = (svc as unknown as { dummyHash: string }).dummyHash;
    expect(hash).toMatch(/^\$2[ab]\$\d+\$/);
  });

  it('calls bcrypt.compare even when user does not exist (timing-attack guard)', async () => {
    const { svc } = await makeService();
    (bcrypt.compare as jest.Mock).mockClear();
    await svc.validateLocalUser('nobody@example.com', 'anypassword');
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
  });

  it('returns null when password does not match', async () => {
    const { svc, users } = await makeService();
    const hashed = await bcrypt.hash('correctpassword', 10);
    (users.findByEmailWithPassword as jest.Mock).mockResolvedValue({
      id: USER_ID,
      email: EMAIL,
      password: hashed,
    });

    const result = await svc.validateLocalUser(EMAIL, 'wrongpassword');
    expect(result).toBeNull();
  });

  it('returns user when credentials are valid', async () => {
    const { svc, users } = await makeService();
    const hashed = await bcrypt.hash(RAW_PASSWORD, 10);
    (users.findByEmailWithPassword as jest.Mock).mockResolvedValue({
      id: USER_ID,
      email: EMAIL,
      password: hashed,
    });

    const result = await svc.validateLocalUser(EMAIL, RAW_PASSWORD);
    expect(result?.id).toBe(USER_ID);
  });
});

describe('AuthService.login', () => {
  it('returns user profile and token pair', async () => {
    const { svc, users } = await makeService();
    (users.findPublicById as jest.Mock).mockResolvedValue({
      id: USER_ID,
      username: 'alice',
      email: EMAIL,
      avatarUrl: null,
    });

    const result = await svc.login(USER_ID, EMAIL);

    expect(result.user?.id).toBe(USER_ID);
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });
});

describe('AuthService.refresh', () => {
  it('throws ForbiddenException when jti has no DB record', async () => {
    const { svc } = await makeService();
    await expect(svc.refresh(USER_ID, EMAIL, 'raw-token', JTI)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when token is expired', async () => {
    const { svc, prisma } = await makeService();
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      id: JTI,
      userId: USER_ID,
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(svc.refresh(USER_ID, EMAIL, 'raw-token', JTI)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when stored userId does not match', async () => {
    const { svc, prisma } = await makeService();
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      id: JTI,
      userId: 'different-user',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 10000),
    });

    await expect(svc.refresh(USER_ID, EMAIL, 'raw-token', JTI)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when token hash does not match', async () => {
    const { svc, prisma } = await makeService();
    const hash = await bcrypt.hash('correct-token', 10);
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      id: JTI,
      userId: USER_ID,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 10000),
    });

    await expect(svc.refresh(USER_ID, EMAIL, 'wrong-token', JTI)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deletes the old token and issues new pair on valid refresh', async () => {
    const { svc, prisma } = await makeService();
    const rawToken = 'valid-refresh-token';
    const rawDigest = createHash('sha256').update(rawToken).digest('hex');
    const hash = await bcrypt.hash(rawDigest, 10);
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      id: JTI,
      userId: USER_ID,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 10000),
    });

    const result = await svc.refresh(USER_ID, EMAIL, rawToken, JTI);

    expect(prisma.refreshToken.delete as jest.Mock).toHaveBeenCalledWith({ where: { id: JTI } });
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });
});

describe('AuthService.logout', () => {
  it('deletes all refresh tokens for the user', async () => {
    const { svc, prisma } = await makeService();
    await svc.logout(USER_ID);

    expect(prisma.refreshToken.deleteMany as jest.Mock).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
  });
});
