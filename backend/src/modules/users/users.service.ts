import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  async updateProfile(userId: string, dto: { username?: string; avatarUrl?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { username: dto.username, avatarUrl: dto.avatarUrl },
      select: { id: true, username: true, email: true, avatarUrl: true },
    });
  }

  async search(query: string, excludeUserId: string) {
    if (query.length < 2) return [];
    return this.prisma.user.findMany({
      where: {
        id: { not: excludeUserId },
        username: { contains: query, mode: 'insensitive' },
      },
      select: { id: true, username: true, avatarUrl: true },
      take: 20,
    });
  }
}
