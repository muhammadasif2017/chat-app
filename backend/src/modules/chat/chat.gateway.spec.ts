import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import type { Socket, Server } from 'socket.io';
import type { ConversationsService } from '../conversations/conversations.service.js';
import type { MessagesService } from '../messages/messages.service.js';
import type { PresenceService } from '../presence/presence.service.js';
import type { PrismaService } from '../../infra/prisma/prisma.service.js';
import type Redis from 'ioredis';
import { ChatGateway } from './chat.gateway.js';

const USER_ID = 'user-uuid';
const CONV_ID = 'conv-uuid';
const MSG_ID = '1';

function makeSocket(token?: string): Socket {
  return {
    data: {},
    handshake: { auth: token ? { token } : {} },
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
  } as unknown as Socket;
}

function makeServer() {
  return {
    to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    in: jest.fn().mockReturnValue({
      socketsJoin: jest.fn(),
      socketsLeave: jest.fn(),
      fetchSockets: jest.fn().mockResolvedValue([{}]),
    }),
  } as unknown as Server;
}

function makeDeps() {
  const jwt = {
    verify: jest.fn().mockReturnValue({ sub: USER_ID, email: 'user@example.com' }),
  } as unknown as JwtService;

  const config = {
    get: jest.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;

  const conversationsService = {
    isMember: jest.fn().mockResolvedValue(true),
    getUserRooms: jest.fn().mockResolvedValue([CONV_ID]),
    getConversationMemberIds: jest.fn().mockResolvedValue([]),
  };

  const messagesService = {
    create: jest.fn().mockResolvedValue({
      id: BigInt(MSG_ID),
      conversationId: CONV_ID,
      senderId: USER_ID,
      content: 'hello',
      type: 'TEXT',
      replyToId: null,
      reactions: [],
    }),
  };

  const presenceService = {
    setOnline: jest.fn().mockResolvedValue(undefined),
    setOffline: jest.fn().mockResolvedValue(undefined),
    getPresence: jest.fn().mockResolvedValue(new Map()),
    setTyping: jest.fn().mockResolvedValue(undefined),
    clearTyping: jest.fn().mockResolvedValue(undefined),
    refreshHeartbeat: jest.fn().mockResolvedValue(undefined),
  };

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: USER_ID }),
    },
    message: {
      findUnique: jest.fn().mockResolvedValue({ conversationId: CONV_ID }),
    },
    messageReaction: {
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
  };

  const redis = {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  };

  return { jwt, config, conversationsService, messagesService, presenceService, prisma, redis };
}

function makeGateway() {
  const deps = makeDeps();
  const gateway = new ChatGateway(
    deps.jwt,
    deps.config,
    deps.conversationsService as unknown as ConversationsService,
    deps.messagesService as unknown as MessagesService,
    deps.presenceService as unknown as PresenceService,
    deps.prisma as unknown as PrismaService,
    deps.redis as unknown as Redis,
  );
  gateway.server = makeServer();
  return { gateway, ...deps };
}

describe('ChatGateway.handleConnection', () => {
  it('disconnects when no access_token present', async () => {
    const { gateway } = makeGateway();
    const socket = makeSocket();
    await gateway.handleConnection(socket);
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('disconnects when JWT verification throws', async () => {
    const { gateway, jwt } = makeGateway();
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('invalid token');
    });
    const socket = makeSocket('bad-token');
    await gateway.handleConnection(socket);
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('disconnects when user not found in DB', async () => {
    const { gateway, prisma } = makeGateway();
    prisma.user.findUnique.mockResolvedValue(null);
    const socket = makeSocket('valid-token');
    await gateway.handleConnection(socket);
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('joins user room and conversation rooms on valid connection', async () => {
    const { gateway } = makeGateway();
    const socket = makeSocket('valid-token');
    await gateway.handleConnection(socket);
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.join).toHaveBeenCalledWith(`user:${USER_ID}`);
    expect(socket.join).toHaveBeenCalledWith([`conversation:${CONV_ID}`]);
  });

  it('attaches userId to socket.data', async () => {
    const { gateway } = makeGateway();
    const socket = makeSocket('valid-token');
    await gateway.handleConnection(socket);
    expect((socket.data as { userId: string }).userId).toBe(USER_ID);
  });
});

describe('ChatGateway.handleSendMessage', () => {
  it('throws WsException when user is not a member', async () => {
    const { gateway, conversationsService } = makeGateway();
    conversationsService.isMember.mockResolvedValue(false);
    const socket = makeSocket('valid-token');
    socket.data = { userId: USER_ID };

    await expect(
      gateway.handleSendMessage(socket, { conversationId: CONV_ID, content: 'hi' }),
    ).rejects.toThrow(WsException);
  });

  it('throws WsException when rate limit is exceeded', async () => {
    const { gateway, redis } = makeGateway();
    redis.incr.mockResolvedValue(11);
    const socket = makeSocket('valid-token');
    socket.data = { userId: USER_ID };

    await expect(
      gateway.handleSendMessage(socket, { conversationId: CONV_ID, content: 'hi' }),
    ).rejects.toThrow(WsException);
  });

  it('disconnects and throws when the access token has expired', async () => {
    const { gateway, jwt } = makeGateway();
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const socket = makeSocket('expired-token');
    socket.data = { userId: USER_ID, token: 'expired-token' };

    await expect(
      gateway.handleSendMessage(socket, { conversationId: CONV_ID, content: 'hi' }),
    ).rejects.toThrow(WsException);
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('broadcasts new_message to conversation room on success', async () => {
    const { gateway } = makeGateway();
    const socket = makeSocket('valid-token');
    socket.data = { userId: USER_ID };

    await gateway.handleSendMessage(socket, { conversationId: CONV_ID, content: 'hello' });

    expect(gateway.server.to).toHaveBeenCalledWith(`conversation:${CONV_ID}`);
    const roomEmit = (
      (gateway.server.to as jest.Mock).mock.results[0] as { value: { emit: jest.Mock } }
    ).value.emit;
    expect(roomEmit).toHaveBeenCalledWith('new_message', expect.objectContaining({ id: MSG_ID }));
  });

  it('serializes BigInt message id to string', async () => {
    const { gateway } = makeGateway();
    const socket = makeSocket('valid-token');
    socket.data = { userId: USER_ID };

    const result = (await gateway.handleSendMessage(socket, {
      conversationId: CONV_ID,
      content: 'hello',
    })) as { id: string };

    expect(typeof result.id).toBe('string');
  });
});

describe('ChatGateway.handleAddReaction', () => {
  it('throws WsException when message not found', async () => {
    const { gateway, prisma } = makeGateway();
    prisma.message.findUnique.mockResolvedValue(null);
    const socket = makeSocket('valid-token');
    socket.data = { userId: USER_ID };

    await expect(
      gateway.handleAddReaction(socket, { messageId: MSG_ID, emoji: '👍' }),
    ).rejects.toThrow(WsException);
  });

  it('upserts reaction and emits reaction_added to room', async () => {
    const { gateway, prisma } = makeGateway();
    const socket = makeSocket('valid-token');
    socket.data = { userId: USER_ID };

    await gateway.handleAddReaction(socket, { messageId: MSG_ID, emoji: '❤️' });

    expect(prisma.messageReaction.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ emoji: '❤️' }) as unknown }),
    );
    expect(gateway.server.to).toHaveBeenCalledWith(`conversation:${CONV_ID}`);
  });
});
