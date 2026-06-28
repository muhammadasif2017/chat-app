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
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import type Redis from 'ioredis';
import { ConversationsService } from '../conversations/conversations.service.js';
import { MessagesService } from '../messages/messages.service.js';
import { PresenceService } from '../presence/presence.service.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter.js';
import { SendMessageDto } from '../messages/dto/send-message.dto.js';
import { EditMessageDto } from '../messages/dto/edit-message.dto.js';
import { REDIS_CLIENT } from '../../infra/redis/redis.module.js';

@UseFilters(WsExceptionFilter)
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || origin === process.env.FRONTEND_URL) cb(null, true);
      else cb(new Error('CORS: origin not allowed'));
    },
    credentials: true,
  },
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

  private async assertMember(conversationId: string, userId: string): Promise<void> {
    const isMember = await this.conversationsService.isMember(conversationId, userId);
    if (!isMember) throw new WsException('Not a member');
  }

  private async checkRateLimit(userId: string, prefix = 'ws_rl', limit = 10): Promise<void> {
    const window = Math.floor(Date.now() / 10000);
    const key = `${prefix}:${userId}:${window}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 15);
    if (count > limit) throw new WsException('Rate limit exceeded');
  }

  async handleConnection(client: Socket) {
    try {
      const cookieStr = (client.handshake.headers.cookie as string) ?? '';
      const match = cookieStr
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('access_token='));
      const token = match ? match.slice('access_token='.length) : undefined;
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

      await client.join(`user:${payload.sub}`);
      const roomIds = await this.conversationsService.getUserRooms(payload.sub);
      await client.join(roomIds.map((id) => `conversation:${id}`));

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
  async handleSendMessage(@ConnectedSocket() client: Socket, @MessageBody() dto: SendMessageDto) {
    const userId = client.data.userId as string;
    await this.checkRateLimit(userId);
    await this.assertMember(dto.conversationId, userId);

    const message = await this.messagesService.create(userId, dto);
    const serialized = { ...message, id: String(message.id) };

    this.server.to(`conversation:${dto.conversationId}`).emit('new_message', serialized);
    return { event: 'message_sent', data: serialized };
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(@ConnectedSocket() client: Socket, @MessageBody() dto: EditMessageDto) {
    const userId = client.data.userId as string;
    await this.checkRateLimit(userId);
    const message = await this.messagesService.update(dto.messageId, userId, dto.content);
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
    await this.checkRateLimit(userId);
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
    await this.checkRateLimit(userId, 'ws_rl_typing', 30);
    await this.assertMember(conversationId, userId);
    await this.presenceService.setTyping(conversationId, userId);
    client.to(`conversation:${conversationId}`).emit('user_typing', { userId, conversationId });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() { conversationId }: { conversationId: string },
  ) {
    const userId = client.data.userId as string;
    await this.checkRateLimit(userId, 'ws_rl_typing', 30);
    await this.assertMember(conversationId, userId);
    await this.presenceService.clearTyping(conversationId, userId);
    client
      .to(`conversation:${conversationId}`)
      .emit('user_stopped_typing', { userId, conversationId });
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() { conversationId }: { conversationId: string },
  ) {
    const userId = client.data.userId as string;
    await this.checkRateLimit(userId);
    await this.assertMember(conversationId, userId);
    const lastReadAt = await this.conversationsService.markRead(conversationId, userId);
    const payload = { userId, conversationId, lastReadAt };
    client.to(`conversation:${conversationId}`).emit('message_read', payload);
    client.emit('message_read', payload);
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId as string;
    if (userId) {
      await this.checkRateLimit(userId, 'ws_rl_ping', 6);
      await this.presenceService.refreshHeartbeat(userId);
    }
    return { event: 'pong' };
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() { conversationId }: { conversationId: string },
  ) {
    const userId = client.data.userId as string;
    await this.checkRateLimit(userId);
    await this.assertMember(conversationId, userId);
    await client.join(`conversation:${conversationId}`);
  }

  @OnEvent('internal.group.created')
  handleGroupCreated({
    conversationId,
    memberIds,
  }: {
    conversationId: string;
    memberIds: string[];
  }) {
    for (const userId of memberIds) {
      this.server.in(`user:${userId}`).socketsJoin(`conversation:${conversationId}`);
      this.server.to(`user:${userId}`).emit('new_conversation', { conversationId });
    }
  }

  @OnEvent('internal.member.added')
  handleMemberAdded(payload: {
    conversationId: string;
    member: {
      userId: string;
      role: string;
      joinedAt: Date;
      user: { id: string; username: string; avatarUrl: string | null };
    };
    systemMessage: Record<string, unknown>;
  }) {
    this.server
      .in(`user:${payload.member.userId}`)
      .socketsJoin(`conversation:${payload.conversationId}`);
    this.server
      .to(`user:${payload.member.userId}`)
      .emit('new_conversation', { conversationId: payload.conversationId });
    this.server.to(`conversation:${payload.conversationId}`).emit('member_added', {
      conversationId: payload.conversationId,
      member: payload.member,
    });
    this.server
      .to(`conversation:${payload.conversationId}`)
      .emit('new_message', payload.systemMessage);
  }

  @OnEvent('internal.member.removed')
  handleMemberRemoved(payload: {
    conversationId: string;
    userId: string;
    systemMessage: Record<string, unknown>;
  }) {
    this.server.to(`conversation:${payload.conversationId}`).emit('member_removed', {
      conversationId: payload.conversationId,
      userId: payload.userId,
    });
    this.server
      .to(`conversation:${payload.conversationId}`)
      .emit('new_message', payload.systemMessage);
    this.server.in(`user:${payload.userId}`).socketsLeave(`conversation:${payload.conversationId}`);
  }

  @OnEvent('internal.group.updated')
  handleGroupUpdated(payload: {
    conversationId: string;
    name: string | null;
    description: string | null;
  }) {
    this.server.to(`conversation:${payload.conversationId}`).emit('group_updated', payload);
  }

  @OnEvent('internal.member.role_changed')
  handleMemberRoleChanged(payload: { conversationId: string; userId: string; role: string }) {
    this.server.to(`conversation:${payload.conversationId}`).emit('member_role_changed', payload);
  }
}
