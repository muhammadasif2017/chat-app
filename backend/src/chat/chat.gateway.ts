import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Inject, UseFilters } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import type Redis from 'ioredis';
import { ConversationsService } from '../conversations/conversations.service.js';
import { MessagesService } from '../messages/messages.service.js';
import { PresenceService } from '../presence/presence.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { WsExceptionFilter } from '../common/filters/ws-exception.filter.js';
import { SendMessageDto } from '../messages/dto/send-message.dto.js';
import { REDIS_CLIENT } from '../redis/redis.module.js';

@UseFilters(WsExceptionFilter)
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private conversationsService: ConversationsService,
    private messagesService: MessagesService,
    private presenceService: PresenceService,
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  private async checkRateLimit(userId: string): Promise<void> {
    const window = Math.floor(Date.now() / 10000);
    const key = `ws_rl:${userId}:${window}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 15);
    if (count > 10) throw new WsException('Rate limit exceeded');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) return client.disconnect();

      const payload = this.jwt.verify<{ sub: string; email: string }>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });
      if (!user) return client.disconnect();

      client.data.userId = payload.sub;

      const roomIds = await this.conversationsService.getUserRooms(payload.sub);
      await Promise.all(roomIds.map((id) => client.join(`conversation:${id}`)));

      await this.presenceService.setOnline(payload.sub, client.id);

      roomIds.forEach((id) => {
        client.to(`conversation:${id}`).emit('user_online', { userId: payload.sub });
      });
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;

    await this.presenceService.setOffline(userId);

    const roomIds = await this.conversationsService.getUserRooms(userId);
    roomIds.forEach((id) => {
      this.server.to(`conversation:${id}`).emit('user_offline', { userId });
    });
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const userId = client.data.userId as string;
    await this.checkRateLimit(userId);
    const isMember = await this.conversationsService.isMember(dto.conversationId, userId);
    if (!isMember) throw new WsException('Not a member of this conversation');

    const message = await this.messagesService.create(userId, dto);
    const serialized = { ...message, id: String(message.id) };

    this.server.to(`conversation:${dto.conversationId}`).emit('new_message', serialized);
    return { event: 'message_sent', data: serialized };
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() { messageId, content }: { messageId: string; content: string },
  ) {
    const userId = client.data.userId as string;
    await this.checkRateLimit(userId);
    const message = await this.messagesService.update(messageId, userId, content);
    const serialized = { ...message, id: String(message.id) };
    this.server.to(`conversation:${message.conversationId}`).emit('message_updated', serialized);
    return { event: 'message_edited', data: serialized };
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() { messageId }: { messageId: string },
  ) {
    const userId = client.data.userId as string;
    const message = await this.messagesService.softDelete(messageId, userId);
    const serialized = { ...message, id: String(message.id) };
    this.server.to(`conversation:${message.conversationId}`).emit('message_deleted', serialized);
    return { event: 'message_deleted_ack', data: serialized };
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() { conversationId }: { conversationId: string },
  ) {
    const userId = client.data.userId as string;
    const isMember = await this.conversationsService.isMember(conversationId, userId);
    if (!isMember) throw new WsException('Not a member');
    await this.presenceService.setTyping(conversationId, userId);
    client.to(`conversation:${conversationId}`).emit('user_typing', { userId, conversationId });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() { conversationId }: { conversationId: string },
  ) {
    const userId = client.data.userId as string;
    const isMember = await this.conversationsService.isMember(conversationId, userId);
    if (!isMember) throw new WsException('Not a member');
    await this.presenceService.clearTyping(conversationId, userId);
    client.to(`conversation:${conversationId}`).emit('user_stopped_typing', { userId, conversationId });
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() { conversationId }: { conversationId: string },
  ) {
    const userId = client.data.userId as string;
    const isMember = await this.conversationsService.isMember(conversationId, userId);
    if (!isMember) throw new WsException('Not a member');
    await this.conversationsService.markRead(conversationId, userId);
    client.to(`conversation:${conversationId}`).emit('message_read', { userId, conversationId });
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId as string;
    if (userId) await this.presenceService.refreshHeartbeat(userId);
    return { event: 'pong' };
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() { conversationId }: { conversationId: string },
  ) {
    const userId = client.data.userId as string;
    const isMember = await this.conversationsService.isMember(conversationId, userId);
    if (!isMember) throw new WsException('Not a member');
    await client.join(`conversation:${conversationId}`);
  }
}
