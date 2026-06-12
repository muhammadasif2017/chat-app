import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { CreateDmDto } from './dto/create-dm.dto.js';
import { UpdateGroupDto } from './dto/update-group.dto.js';

const MEMBER_SELECT = {
  select: { id: true, username: true, email: true, avatarUrl: true },
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
          data: uniqueIds.map((id) => ({ conversationId: conv.id, userId: id, role: 'MEMBER' as const })),
          skipDuplicates: true,
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
          throw new BadRequestException('One or more member IDs do not correspond to existing users');
        }
        throw err;
      }

      return tx.conversation.findUniqueOrThrow({
        where: { id: conv.id },
        include: { members: { include: { user: MEMBER_SELECT } } },
      });
    });

    if (uniqueIds.length) {
      this.events.emit('internal.group.created', { conversationId: conversation.id, memberIds: uniqueIds });
    }

    return conversation;
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
    const member = await (async () => {
      try {
        return await this.prisma.conversationMember.create({
          data: { conversationId, userId: targetUserId, role: 'MEMBER' },
          include: { user: SENDER_SELECT },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
          if (err.code === 'P2003') throw new BadRequestException('User does not exist');
          if (err.code === 'P2002') throw new BadRequestException('User is already a member');
        }
        throw err;
      }
    })();
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
      member: { userId: member.userId, role: member.role, joinedAt: member.joinedAt, user: member.user },
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
      if (ownerCount <= 1) throw new BadRequestException('Cannot remove the only owner');
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
    this.events.emit('internal.member.role_changed', { conversationId, userId: targetUserId, role });
    return updated;
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
