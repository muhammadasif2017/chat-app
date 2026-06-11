import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { CreateDmDto } from './dto/create-dm.dto.js';

const MEMBER_SELECT = {
  select: { id: true, username: true, email: true, avatarUrl: true },
};

@Injectable()
export class ConversationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const members = await this.prisma.conversationMember.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            members: { include: { user: MEMBER_SELECT } },
            messages: {
              orderBy: { id: 'desc' },
              take: 1,
              where: { isDeleted: false },
            },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    return Promise.all(
      members.map(async (m) => {
        const unreadCount = m.lastReadAt
          ? await this.prisma.message.count({
              where: {
                conversationId: m.conversationId,
                createdAt: { gt: m.lastReadAt },
                isDeleted: false,
              },
            })
          : await this.prisma.message.count({
              where: { conversationId: m.conversationId, isDeleted: false },
            });

        return {
          ...m.conversation,
          lastMessage: m.conversation.messages[0] ?? null,
          unreadCount,
          myRole: m.role,
        };
      }),
    );
  }

  async create(userId: string, dto: CreateConversationDto) {
    return this.prisma.conversation.create({
      data: {
        type: dto.type,
        name: dto.name,
        description: dto.description,
        isPublic: dto.isPublic ?? false,
        createdById: userId,
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
      include: { members: { include: { user: MEMBER_SELECT } } },
    });
  }

  async findOrCreateDm(userId: string, dto: CreateDmDto) {
    const [a, b] = [userId, dto.targetUserId].sort();

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        members: { every: { userId: { in: [a, b] } } },
      },
      include: {
        members: {
          where: { userId: { in: [a, b] } },
          include: { user: MEMBER_SELECT },
        },
      },
    });

    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        type: 'DIRECT',
        members: {
          create: [{ userId: a, role: 'MEMBER' }, { userId: b, role: 'MEMBER' }],
        },
      },
      include: { members: { include: { user: MEMBER_SELECT } } },
    });
  }

  async addMember(conversationId: string, requesterId: string, targetUserId: string) {
    await this.assertAdminOrOwner(conversationId, requesterId);
    return this.prisma.conversationMember.create({
      data: { conversationId, userId: targetUserId, role: 'MEMBER' },
    });
  }

  async removeMember(conversationId: string, requesterId: string, targetUserId: string) {
    if (requesterId !== targetUserId) {
      await this.assertAdminOrOwner(conversationId, requesterId);
    }
    await this.prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId, userId: targetUserId } },
    });
  }

  async getUserRooms(userId: string): Promise<string[]> {
    const members = await this.prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    return members.map((m) => m.conversationId);
  }

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    return !!member;
  }

  async markRead(conversationId: string, userId: string) {
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  private async assertAdminOrOwner(conversationId: string, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new NotFoundException();
    if (member.role === 'MEMBER') throw new ForbiddenException();
  }
}
