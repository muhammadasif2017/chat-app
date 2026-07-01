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
import { Inject, Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
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
import { ConversationIdDto, MessageIdDto, ReactionDto } from './dto/ws-events.dto.js';

@UseFilters(WsExceptionFilter)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
@WebSocketGateway({
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private conversationsService: ConversationsService,
    private messagesService: MessagesService,
    private presenceService: PresenceService,
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  private getUserId(client: Socket): string {
    const data = client.data as { userId: string; token?: string };
    try {
      this.jwt.verify(data.token!, { secret: this.config.get<string>('JWT_SECRET') });
    } catch {
      client.disconnect();
      throw new WsException('Session expired');
    }
    return data.userId;
  }

  private async assertMember(conversationId: string, userId: string): Promise<void> {
    const isMember = await this.conversationsService.isMember(conversationId, userId);
    if (!isMember) throw new WsException('Not a member');
  }

  private async assertMessageMember(messageId: string, userId: string): Promise<string> {
    const msg = await this.prisma.message.findUnique({
      where: { id: BigInt(messageId) },
      select: { conversationId: true },
    });
    if (!msg) throw new WsException('Message not found');
    await this.assertMember(msg.conversationId, userId);
    return msg.conversationId;
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

      const data = client.data as { userId: string; token: string };
      data.userId = payload.sub;
      data.token = token;

      await client.join(`user:${payload.sub}`);
      const roomIds = await this.conversationsService.getUserRooms(payload.sub);
      await client.join(roomIds.map((id) => `conversation:${id}`));

      const userSockets = await this.server.in(`user:${payload.sub}`).fetchSockets();
      const isFirstConnection = userSockets.length === 1;

      await this.presenceService.setOnline(payload.sub, client.id);

      if (isFirstConnection) {
        roomIds.forEach((id) => {
          client.to(`conversation:${id}`).emit('user_online', { userId: payload.sub });
        });
      }

      const memberIds = await this.conversationsService.getConversationMemberIds(payload.sub);
      const roster = await this.presenceService.getPresence(memberIds);
      client.emit('presence_roster', Object.fromEntries(roster));
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = (client.data as { userId?: string }).userId;
    if (!userId) return;

    const userSockets = await this.server.in(`user:${userId}`).fetchSockets();
    if (userSockets.length > 0) return;

    await this.presenceService.setOffline(userId);

    const roomIds = await this.conversationsService.getUserRooms(userId);
    roomIds.forEach((id) => {
      this.server.to(`conversation:${id}`).emit('user_offline', { userId });
    });
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(@ConnectedSocket() client: Socket, @MessageBody() dto: SendMessageDto) {
    const userId = this.getUserId(client);
    await this.checkRateLimit(userId);
    await this.assertMember(dto.conversationId, userId);

    const message = await this.messagesService.create(userId, dto);
    const serialized = {
      ...message,
      id: String(message.id),
      replyToId: message.replyToId != null ? String(message.replyToId) : null,
    };

    this.server.to(`conversation:${dto.conversationId}`).emit('new_message', serialized);
    return { event: 'message_sent', data: serialized };
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(@ConnectedSocket() client: Socket, @MessageBody() dto: EditMessageDto) {
    const userId = this.getUserId(client);
    await this.checkRateLimit(userId);
    await this.assertMessageMember(dto.messageId, userId);
    const message = await this.messagesService.update(dto.messageId, userId, dto.content);
    const serialized = {
      ...message,
      id: String(message.id),
      replyToId: message.replyToId != null ? String(message.replyToId) : null,
    };
    this.server.to(`conversation:${message.conversationId}`).emit('message_updated', serialized);
    return { event: 'message_edited', data: serialized };
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() { messageId }: MessageIdDto,
  ) {
    const userId = this.getUserId(client);
    await this.checkRateLimit(userId);
    await this.assertMessageMember(messageId, userId);
    const message = await this.messagesService.softDelete(messageId, userId);
    const serialized = {
      ...message,
      id: String(message.id),
      replyToId: message.replyToId != null ? String(message.replyToId) : null,
    };
    this.server.to(`conversation:${message.conversationId}`).emit('message_deleted', serialized);
    return { event: 'message_deleted_ack', data: serialized };
  }

  @SubscribeMessage('typing_start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() { conversationId }: ConversationIdDto,
  ) {
    const userId = this.getUserId(client);
    await this.checkRateLimit(userId, 'ws_rl_typing', 30);
    await this.assertMember(conversationId, userId);
    await this.presenceService.setTyping(conversationId, userId);
    client.to(`conversation:${conversationId}`).emit('user_typing', { userId, conversationId });
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() { conversationId }: ConversationIdDto,
  ) {
    const userId = this.getUserId(client);
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
    @MessageBody() { conversationId }: ConversationIdDto,
  ) {
    const userId = this.getUserId(client);
    await this.checkRateLimit(userId);
    await this.assertMember(conversationId, userId);
    const lastReadAt = await this.conversationsService.markRead(conversationId, userId);
    const payload = { userId, conversationId, lastReadAt };
    client.to(`conversation:${conversationId}`).emit('message_read', payload);
    client.emit('message_read', payload);
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
    const userId = this.getUserId(client);
    await this.checkRateLimit(userId, 'ws_rl_ping', 6);
    await this.presenceService.refreshHeartbeat(userId);
    return { event: 'pong' };
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() { conversationId }: ConversationIdDto,
  ) {
    const userId = this.getUserId(client);
    await this.checkRateLimit(userId);
    await this.assertMember(conversationId, userId);
    await client.join(`conversation:${conversationId}`);
  }

  @SubscribeMessage('add_reaction')
  async handleAddReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() { messageId, emoji }: ReactionDto,
  ) {
    const userId = this.getUserId(client);
    await this.checkRateLimit(userId, 'ws_rl_reaction', 20);
    const conversationId = await this.assertMessageMember(messageId, userId);
    await this.prisma.messageReaction.upsert({
      where: { messageId_userId_emoji: { messageId: BigInt(messageId), userId, emoji } },
      create: { messageId: BigInt(messageId), userId, emoji },
      update: {},
    });
    this.server
      .to(`conversation:${conversationId}`)
      .emit('reaction_added', { messageId, userId, emoji, conversationId });
  }

  @SubscribeMessage('remove_reaction')
  async handleRemoveReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() { messageId, emoji }: ReactionDto,
  ) {
    const userId = this.getUserId(client);
    await this.checkRateLimit(userId, 'ws_rl_reaction', 20);
    const conversationId = await this.assertMessageMember(messageId, userId);
    await this.prisma.messageReaction.deleteMany({
      where: { messageId: BigInt(messageId), userId, emoji },
    });
    this.server
      .to(`conversation:${conversationId}`)
      .emit('reaction_removed', { messageId, userId, emoji, conversationId });
  }

  @OnEvent('internal.group.created')
  handleGroupCreated({
    conversationId,
    memberIds,
  }: {
    conversationId: string;
    memberIds: string[];
  }) {
    try {
      for (const userId of memberIds) {
        this.server.in(`user:${userId}`).socketsJoin(`conversation:${conversationId}`);
        this.server.to(`user:${userId}`).emit('new_conversation', { conversationId });
      }
    } catch (err: unknown) {
      this.logger.error(`internal.group.created failed: ${String(err)}`);
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
    try {
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
    } catch (err: unknown) {
      this.logger.error(`internal.member.added failed: ${String(err)}`);
    }
  }

  @OnEvent('internal.member.removed')
  handleMemberRemoved(payload: {
    conversationId: string;
    userId: string;
    systemMessage: Record<string, unknown>;
  }) {
    try {
      this.server.to(`conversation:${payload.conversationId}`).emit('member_removed', {
        conversationId: payload.conversationId,
        userId: payload.userId,
      });
      this.server
        .to(`conversation:${payload.conversationId}`)
        .emit('new_message', payload.systemMessage);
      this.server
        .in(`user:${payload.userId}`)
        .socketsLeave(`conversation:${payload.conversationId}`);
    } catch (err: unknown) {
      this.logger.error(`internal.member.removed failed: ${String(err)}`);
    }
  }

  @OnEvent('internal.group.updated')
  handleGroupUpdated(payload: {
    conversationId: string;
    name: string | null;
    description: string | null;
  }) {
    try {
      this.server.to(`conversation:${payload.conversationId}`).emit('group_updated', payload);
    } catch (err: unknown) {
      this.logger.error(`internal.group.updated failed: ${String(err)}`);
    }
  }

  @OnEvent('internal.member.role_changed')
  handleMemberRoleChanged(payload: { conversationId: string; userId: string; role: string }) {
    try {
      this.server.to(`conversation:${payload.conversationId}`).emit('member_role_changed', payload);
    } catch (err: unknown) {
      this.logger.error(`internal.member.role_changed failed: ${String(err)}`);
    }
  }
}
