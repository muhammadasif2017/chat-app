import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { CreateDmDto } from './dto/create-dm.dto.js';
import { UpdateGroupDto } from './dto/update-group.dto.js';

const MEMBER_SELECT = {
  select: { id: true, username: true, avatarUrl: true, lastSeenAt: true },
};

const SENDER_SELECT = {
  select: { id: true, username: true, avatarUrl: true },
};

@Injectable()
export class ConversationsService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  async findAll(userId: string) {
    const [members, unreadRows] = await Promise.all([
      this.prisma.conversationMember.findMany({
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
      }),
      this.prisma.$queryRaw<{ conversationId: string; unreadCount: number }[]>`
        SELECT
          cm."conversationId",
          CAST(COUNT(m.id) AS INTEGER) AS "unreadCount"
        FROM "ConversationMember" cm
        LEFT JOIN "Message" m
          ON m."conversationId" = cm."conversationId"
          AND m."isDeleted" = false
          AND (cm."lastReadAt" IS NULL OR m."createdAt" > cm."lastReadAt")
        WHERE cm."userId" = ${userId}
        GROUP BY cm."conversationId"
      `,
    ]);

    const unreadMap = new Map(unreadRows.map((r) => [r.conversationId, r.unreadCount]));

    return members.map((m) => ({
      ...m.conversation,
      lastMessage: m.conversation.messages[0] ?? null,
      unreadCount: unreadMap.get(m.conversationId) ?? 0,
      myRole: m.role,
    }));
  }

  async findOne(userId: string, conversationId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      include: {
        conversation: {
          include: {
            members: { include: { user: MEMBER_SELECT } },
            messages: { orderBy: { id: 'desc' }, take: 1, where: { isDeleted: false } },
          },
        },
      },
    });
    if (!member) throw new NotFoundException();

    const unreadCount = member.lastReadAt
      ? await this.prisma.message.count({
          where: { conversationId, createdAt: { gt: member.lastReadAt }, isDeleted: false },
        })
      : await this.prisma.message.count({ where: { conversationId, isDeleted: false } });

    return {
      ...member.conversation,
      lastMessage: member.conversation.messages[0] ?? null,
      unreadCount,
      myRole: member.role,
    };
  }

  async create(userId: string, dto: CreateConversationDto) {
    const uniqueIds = dto.memberIds?.length
      ? [...new Set(dto.memberIds)].filter((id) => id !== userId)
      : [];

    const conversation = await this.prisma.$transaction(async (tx) => {
      const conv = await tx.conversation.create({
        data: {
          type: dto.type,
          name: this.sanitizeText(dto.name),
          description: dto.description ? this.sanitizeText(dto.description) : dto.description,
          isPublic: dto.isPublic ?? false,
          createdById: userId,
          members: { create: { userId, role: 'OWNER' } },
        },
        include: { members: { include: { user: MEMBER_SELECT } } },
      });

      if (!uniqueIds.length) return conv;

      try {
        await tx.conversationMember.createMany({
          data: uniqueIds.map((id) => ({
            conversationId: conv.id,
            userId: id,
            role: 'MEMBER' as const,
          })),
          skipDuplicates: true,
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
          throw new BadRequestException(
            'One or more member IDs do not correspond to existing users',
          );
        }
        throw err;
      }

      return tx.conversation.findUniqueOrThrow({
        where: { id: conv.id },
        include: { members: { include: { user: MEMBER_SELECT } } },
      });
    });

    if (uniqueIds.length) {
      this.events.emit('internal.group.created', {
        conversationId: conversation.id,
        memberIds: [userId, ...uniqueIds],
      });
    }

    return conversation;
  }

  async findOrCreateDm(userId: string, dto: CreateDmDto) {
    if (dto.targetUserId === userId) {
      throw new BadRequestException('Cannot start a DM with yourself');
    }

    const [a, b] = [userId, dto.targetUserId].sort();
    const dmKey = `dm:${a}:${b}`;

    const memberInclude = {
      where: { userId: { in: [a, b] } },
      include: { user: MEMBER_SELECT },
    };

    const existing = await this.prisma.conversation.findUnique({
      where: { dmKey },
      include: { members: memberInclude },
    });
    if (existing) return existing;

    try {
      return await this.prisma.conversation.create({
        data: {
          type: 'DIRECT',
          dmKey,
          members: {
            create: [
              { userId: a, role: 'MEMBER' },
              { userId: b, role: 'MEMBER' },
            ],
          },
        },
        include: { members: { include: { user: MEMBER_SELECT } } },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.prisma.conversation.findUniqueOrThrow({
          where: { dmKey },
          include: { members: memberInclude },
        });
      }
      throw err;
    }
  }

  async updateGroup(conversationId: string, requesterId: string, dto: UpdateGroupDto) {
    await this.assertAdminOrOwner(conversationId, requesterId);
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        name: dto.name !== undefined ? this.sanitizeText(dto.name) : undefined,
        description: dto.description !== undefined ? this.sanitizeText(dto.description) : undefined,
      },
      include: { members: { include: { user: MEMBER_SELECT } } },
    });
    this.events.emit('internal.group.updated', {
      conversationId,
      name: updated.name,
      description: updated.description,
    });
    return updated;
  }

  async addMember(conversationId: string, requesterId: string, targetUserId: string) {
    await this.assertAdminOrOwner(conversationId, requesterId);
    const member = await this.createMember(conversationId, targetUserId);
    const systemMessage = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: targetUserId,
        type: 'SYSTEM',
        content: null,
        metadata: { event: 'member_joined', userId: targetUserId },
      },
      include: { sender: SENDER_SELECT },
    });
    this.events.emit('internal.member.added', {
      conversationId,
      member: {
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        user: member.user,
      },
      systemMessage: { ...systemMessage, id: String(systemMessage.id) },
    });
    return member;
  }

  async removeMember(conversationId: string, requesterId: string, targetUserId: string) {
    if (requesterId !== targetUserId) {
      await this.assertAdminOrOwner(conversationId, requesterId);
    }

    const target = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException();

    if (target.role === 'OWNER') {
      const ownerCount = await this.prisma.conversationMember.count({
        where: { conversationId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        if (requesterId !== targetUserId) {
          throw new BadRequestException('Cannot remove the only owner');
        }
        const successor = await this.prisma.conversationMember.findFirst({
          where: { conversationId, userId: { not: targetUserId } },
          orderBy: { joinedAt: 'asc' },
        });
        if (successor) {
          await this.prisma.conversationMember.update({
            where: { conversationId_userId: { conversationId, userId: successor.userId } },
            data: { role: 'OWNER' },
          });
          this.events.emit('internal.member.role_changed', {
            conversationId,
            userId: successor.userId,
            role: 'OWNER',
          });
        }
      }
    }

    await this.prisma.conversationMember.delete({
      where: { conversationId_userId: { conversationId, userId: targetUserId } },
    });

    const systemMessage = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: requesterId,
        type: 'SYSTEM',
        content: null,
        metadata: { event: 'member_left', userId: targetUserId },
      },
      include: { sender: SENDER_SELECT },
    });
    this.events.emit('internal.member.removed', {
      conversationId,
      userId: targetUserId,
      systemMessage: { ...systemMessage, id: String(systemMessage.id) },
    });
  }

  async updateMemberRole(
    conversationId: string,
    requesterId: string,
    targetUserId: string,
    role: 'ADMIN' | 'MEMBER',
  ) {
    await this.assertOwner(conversationId, requesterId);
    if (requesterId === targetUserId) throw new BadRequestException('Cannot change your own role');

    const target = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException();

    if (target.role === 'OWNER') {
      const ownerCount = await this.prisma.conversationMember.count({
        where: { conversationId, role: 'OWNER' },
      });
      if (ownerCount <= 1) throw new BadRequestException('Cannot demote the only owner');
    }

    const updated = await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: targetUserId } },
      data: { role },
    });
    this.events.emit('internal.member.role_changed', {
      conversationId,
      userId: targetUserId,
      role,
    });
    return updated;
  }

  async getUserRooms(userId: string): Promise<string[]> {
    const members = await this.prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    return members.map((m) => m.conversationId);
  }

  async getConversationMemberIds(userId: string): Promise<string[]> {
    const members = await this.prisma.conversationMember.findMany({
      where: {
        conversation: { members: { some: { userId } } },
        userId: { not: userId },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    return members.map((m) => m.userId);
  }

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    return !!member;
  }

  async markRead(conversationId: string, userId: string): Promise<Date> {
    const lastReadAt = new Date();
    try {
      await this.prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Member record not found');
      }
      throw err;
    }
    return lastReadAt;
  }

  private async createMember(conversationId: string, userId: string) {
    try {
      return await this.prisma.conversationMember.create({
        data: { conversationId, userId, role: 'MEMBER' },
        include: { user: SENDER_SELECT },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2003') throw new BadRequestException('User does not exist');
        if (err.code === 'P2002') throw new BadRequestException('User is already a member');
      }
      throw err;
    }
  }

  private async assertAdminOrOwner(conversationId: string, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new NotFoundException();
    if (member.role === 'MEMBER') throw new ForbiddenException();
  }

  private async assertOwner(conversationId: string, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new NotFoundException();
    if (member.role !== 'OWNER') throw new ForbiddenException();
  }

  private sanitizeText(text: string): string {
    return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
  }
}
