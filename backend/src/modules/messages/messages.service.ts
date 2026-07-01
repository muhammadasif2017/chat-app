import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { MessageType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';

const SENDER_SELECT = {
  select: { id: true, username: true, avatarUrl: true },
};

const REACTION_SELECT = {
  select: { userId: true, emoji: true },
};

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async findMany(conversationId: string, cursor?: string, limit = 50, q?: string) {
    if (q) {
      // Search returns a single capped page; cursor pagination is intentionally not supported here.
      const results = await this.prisma.message.findMany({
        where: { conversationId, isDeleted: false, content: { contains: q, mode: 'insensitive' } },
        orderBy: { id: 'desc' },
        take: limit,
        include: { sender: SENDER_SELECT, reactions: REACTION_SELECT },
      });
      return { messages: results.reverse(), nextCursor: null };
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
        ...(cursor ? { id: { lt: BigInt(cursor) } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit,
      include: { sender: SENDER_SELECT, reactions: REACTION_SELECT },
    });

    return {
      messages: messages.reverse(),
      nextCursor: messages.length === limit ? String(messages[0]?.id) : null,
    };
  }

  async create(senderId: string, dto: SendMessageDto) {
    const content = dto.content
      ? sanitizeHtml(dto.content, { allowedTags: [], allowedAttributes: {} })
      : null;
    return this.prisma.$transaction(async (tx) => {
      if (dto.replyToId) {
        const ref = await tx.message.findUnique({
          where: { id: BigInt(dto.replyToId) },
          select: { conversationId: true },
        });
        if (!ref || ref.conversationId !== dto.conversationId) {
          throw new BadRequestException('Invalid replyToId');
        }
      }

      const message = await tx.message.create({
        data: {
          conversationId: dto.conversationId,
          senderId,
          content,
          type: (dto.type as MessageType) ?? MessageType.TEXT,
          metadata: dto.metadata as Record<string, string> | undefined,
          replyToId: dto.replyToId ? BigInt(dto.replyToId) : undefined,
        },
        include: { sender: SENDER_SELECT, reactions: REACTION_SELECT },
      });
      await tx.conversation.update({
        where: { id: dto.conversationId },
        data: { updatedAt: new Date() },
      });
      return message;
    });
  }

  async softDelete(messageId: string, userId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: BigInt(messageId) },
    });
    if (!msg) throw new NotFoundException();
    if (msg.senderId !== userId) throw new ForbiddenException();

    return this.prisma.message.update({
      where: { id: BigInt(messageId) },
      data: { isDeleted: true, content: null },
      include: { sender: SENDER_SELECT, reactions: REACTION_SELECT },
    });
  }

  async update(messageId: string, userId: string, content: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: BigInt(messageId) },
    });
    if (!msg) throw new NotFoundException();
    if (msg.senderId !== userId) throw new ForbiddenException();

    const sanitized = sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} });
    return this.prisma.message.update({
      where: { id: BigInt(messageId) },
      data: { content: sanitized, isEdited: true },
      include: { sender: SENDER_SELECT, reactions: REACTION_SELECT },
    });
  }
}
