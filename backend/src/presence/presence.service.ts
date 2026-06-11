import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

const PRESENCE_TTL = 30;

@Injectable()
export class PresenceService {
  constructor(
    @Inject(REDIS_CLIENT) private redis: Redis,
    private prisma: PrismaService,
  ) {}

  async setOnline(userId: string, socketId: string) {
    await this.redis.set(
      `presence:${userId}`,
      JSON.stringify({ socketId }),
      'EX',
      PRESENCE_TTL,
    );
  }

  async setOffline(userId: string) {
    await Promise.all([
      this.redis.del(`presence:${userId}`),
      this.prisma.user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date() },
      }),
    ]);
  }

  async refreshHeartbeat(userId: string) {
    await this.redis.expire(`presence:${userId}`, PRESENCE_TTL);
  }

  async getPresence(userIds: string[]): Promise<Map<string, boolean>> {
    if (!userIds.length) return new Map();
    const pipeline = this.redis.pipeline();
    userIds.forEach((id) => pipeline.exists(`presence:${id}`));
    const results = await pipeline.exec();
    const map = new Map<string, boolean>();
    userIds.forEach((id, i) => {
      map.set(id, results?.[i]?.[1] === 1);
    });
    return map;
  }

  async setTyping(conversationId: string, userId: string) {
    await this.redis.set(`typing:${conversationId}:${userId}`, '1', 'EX', 3);
  }

  async clearTyping(conversationId: string, userId: string) {
    await this.redis.del(`typing:${conversationId}:${userId}`);
  }
}
