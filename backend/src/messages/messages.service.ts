import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../prisma/prisma.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';

const SENDER_SELECT = {
  select: { id: true, username: true, avatarUrl: true },
};

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async findMany(conversationId: string, cursor?: string, limit = 50) {
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor ? { id: { lt: BigInt(cursor) } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit,
      include: { sender: SENDER_SELECT },
    });

    return {
      messages: messages.reverse(),
      nextCursor: messages.length === limit ? String(messages[0]?.id) : null,
    };
  }

  async create(senderId: string, dto: SendMessageDto) {
    const content = sanitizeHtml(dto.content, { allowedTags: [], allowedAttributes: {} });
    return this.prisma.message.create({
      data: {
        conversationId: dto.conversationId,
        senderId,
        content,
        replyToId: dto.replyToId ? BigInt(dto.replyToId) : undefined,
      },
      include: { sender: SENDER_SELECT },
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
      include: { sender: SENDER_SELECT },
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
      include: { sender: SENDER_SELECT },
    });
  }
}
