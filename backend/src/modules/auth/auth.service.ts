import { BadRequestException, ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID, createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import ms, { type StringValue } from 'ms';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService implements OnModuleInit {
  // Computed once at startup; ensures bcrypt.compare always runs to prevent timing-based email enumeration
  private dummyHash!: string;

  constructor(
    private prisma: PrismaService,
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    this.dummyHash = await bcrypt.hash('dummy-constant-time-guard', 10);
  }

  async validateLocalUser(email: string, password: string) {
    const user = await this.users.findByEmailWithPassword(email);
    const hash = user?.password ?? this.dummyHash;
    const matches = await bcrypt.compare(password, hash);
    return user && matches ? user : null;
  }

  async register(dto: RegisterDto) {
    const exists = await this.users.findByEmailOrUsername(dto.email, dto.username);
    if (exists) {
      throw new BadRequestException('Registration failed');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      username: dto.username,
      email: dto.email,
      password: hashed,
    });

    const tokens = await this.issueTokens(user.id, user.email);
    return {
      ...tokens,
      user: { id: user.id, username: user.username, email: user.email, avatarUrl: user.avatarUrl },
    };
  }

  async login(userId: string, email: string) {
    const user = await this.users.findPublicById(userId);
    const tokens = await this.issueTokens(userId, email);
    return { ...tokens, user };
  }

  async refresh(userId: string, email: string, rawRefreshToken: string, jti: string) {
    const stored = await this.prisma.refreshToken.findUnique({ where: { id: jti } });
    if (!stored || stored.userId !== userId || stored.expiresAt < new Date()) {
      // jti not found after a valid JWT signature means the token was already rotated —
      // a second presenter means one copy was stolen. Revoke all sessions for this user.
      await this.prisma.refreshToken.deleteMany({ where: { userId } });
      throw new ForbiddenException();
    }

    const rawDigest = createHash('sha256').update(rawRefreshToken).digest('hex');
    const valid = await bcrypt.compare(rawDigest, stored.tokenHash);
    if (!valid) throw new ForbiddenException();

    await this.prisma.refreshToken.delete({ where: { id: jti } });
    return this.issueTokens(userId, email);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  private async issueTokens(userId: string, email: string) {
    const jti = randomUUID();
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN'),
      }),
      this.jwt.signAsync(
        { ...payload, jti },
        {
          secret: this.config.get('JWT_REFRESH_SECRET'),
          expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
        },
      ),
    ]);

    const tokenDigest = createHash('sha256').update(refreshToken).digest('hex');
    const tokenHash = await bcrypt.hash(tokenDigest, 10);
    const refreshExpiry = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const expiresAt = new Date(Date.now() + ms(refreshExpiry as StringValue));

    // Single-device enforcement: only one active session per user.
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    await this.prisma.refreshToken.create({
      data: { id: jti, userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
