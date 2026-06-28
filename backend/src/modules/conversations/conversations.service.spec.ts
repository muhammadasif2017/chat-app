import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { ConversationsService } from './conversations.service';

const OWNER_ID = 'owner-uuid';
const ADMIN_ID = 'admin-uuid';
const MEMBER_ID = 'member-uuid';
const CONV_ID = 'conv-uuid';

function makeFkError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('FK constraint failed', {
    code,
    clientVersion: '7.x',
  });
}

function makeMember(userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') {
  return {
    conversationId: CONV_ID,
    userId,
    role,
    isMuted: false,
    lastReadAt: null,
    joinedAt: new Date(),
  };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  const mock = {
    conversationMember: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn(),
      createMany: jest.fn(),
      delete: jest.fn(),
    },
    conversation: {
      create: jest.fn(),
      update: jest
        .fn()
        .mockResolvedValue({ id: CONV_ID, name: 'x', description: null, members: [] }),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    message: {
      create: jest.fn().mockResolvedValue({
        id: BigInt(1),
        conversationId: CONV_ID,
        senderId: MEMBER_ID,
        type: 'SYSTEM',
        content: null,
        metadata: {},
        createdAt: new Date(),
        sender: {},
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    ...overrides,
  };
  return {
    ...mock,
    $transaction: jest
      .fn()
      .mockImplementation((cb: (tx: typeof mock) => Promise<unknown>) => cb(mock)),
  };
}

function makeService(prismaOverrides = {}) {
  const prisma = makePrisma(prismaOverrides) as any;
  const events = { emit: jest.fn() } as unknown as EventEmitter2;
  return new ConversationsService(prisma, events);
}

function fakeConvMemberWithConversation(
  userId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER',
  overrides: Record<string, unknown> = {},
) {
  return {
    conversationId: CONV_ID,
    userId,
    role,
    lastReadAt: null,
    joinedAt: new Date(),
    conversation: {
      id: CONV_ID,
      type: 'GROUP',
      name: 'Test Group',
      description: null,
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [
        {
          userId,
          role,
          user: { id: userId, username: 'alice', email: 'a@b.com', avatarUrl: null },
        },
      ],
      messages: [],
      ...overrides,
    },
  };
}

describe('ConversationsService.findOne', () => {
  it('throws NotFoundException when user is not a member', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(null);
    const svc = makeService(prisma);

    await expect(svc.findOne(MEMBER_ID, CONV_ID)).rejects.toThrow(NotFoundException);
  });

  it('returns conversation with myRole set from member record', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(
      fakeConvMemberWithConversation(OWNER_ID, 'OWNER'),
    );
    prisma.message.count.mockResolvedValue(0);
    const svc = makeService(prisma);

    const result = await svc.findOne(OWNER_ID, CONV_ID);

    expect(result.myRole).toBe('OWNER');
    expect(result.id).toBe(CONV_ID);
  });

  it('sets lastMessage to first message in the array', async () => {
    const prisma = makePrisma();
    const msg = { id: BigInt(99), content: 'hello', createdAt: new Date() };
    prisma.conversationMember.findUnique.mockResolvedValue(
      fakeConvMemberWithConversation(OWNER_ID, 'OWNER', { messages: [msg] }),
    );
    prisma.message.count.mockResolvedValue(0);
    const svc = makeService(prisma);

    const result = await svc.findOne(OWNER_ID, CONV_ID);

    expect(result.lastMessage).toBe(msg);
  });

  it('sets lastMessage to null when no messages exist', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(
      fakeConvMemberWithConversation(OWNER_ID, 'OWNER', { messages: [] }),
    );
    prisma.message.count.mockResolvedValue(0);
    const svc = makeService(prisma);

    const result = await svc.findOne(OWNER_ID, CONV_ID);

    expect(result.lastMessage).toBeNull();
  });

  it('returns unreadCount from message.count', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(
      fakeConvMemberWithConversation(MEMBER_ID, 'MEMBER'),
    );
    prisma.message.count.mockResolvedValue(5);
    const svc = makeService(prisma);

    const result = await svc.findOne(MEMBER_ID, CONV_ID);

    expect(result.unreadCount).toBe(5);
  });
});

describe('ConversationsService.markRead', () => {
  it('returns a Date', async () => {
    const svc = makeService();
    const result = await svc.markRead(CONV_ID, MEMBER_ID);
    expect(result).toBeInstanceOf(Date);
  });

  it('returns a timestamp close to now', async () => {
    const before = Date.now();
    const svc = makeService();
    const result = await svc.markRead(CONV_ID, MEMBER_ID);
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  it('calls update with the correct where clause and lastReadAt in data', async () => {
    const prisma = makePrisma();
    const svc = makeService(prisma);

    const result = await svc.markRead(CONV_ID, MEMBER_ID);

    const updateCall = prisma.conversationMember.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({
      conversationId_userId: { conversationId: CONV_ID, userId: MEMBER_ID },
    });
    expect(updateCall.data.lastReadAt).toBe(result);
  });

  it('throws NotFoundException when the member row no longer exists (P2025 race condition)', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.update.mockRejectedValue(makeFkError('P2025'));
    const svc = makeService(prisma);

    await expect(svc.markRead(CONV_ID, MEMBER_ID)).rejects.toThrow(NotFoundException);
  });

  it('re-throws unexpected errors from the update call', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.update.mockRejectedValue(new Error('db connection lost'));
    const svc = makeService(prisma);

    await expect(svc.markRead(CONV_ID, MEMBER_ID)).rejects.toThrow('db connection lost');
  });
});

describe('ConversationsService.updateMemberRole', () => {
  it('throws ForbiddenException when requester is ADMIN (not OWNER)', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(makeMember(ADMIN_ID, 'ADMIN'));
    const svc = makeService(prisma);

    await expect(svc.updateMemberRole(CONV_ID, ADMIN_ID, MEMBER_ID, 'ADMIN')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws BadRequestException when requester tries to change their own role', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(makeMember(OWNER_ID, 'OWNER'));
    const svc = makeService(prisma);

    await expect(svc.updateMemberRole(CONV_ID, OWNER_ID, OWNER_ID, 'MEMBER')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws NotFoundException when target is not a member', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique
      .mockResolvedValueOnce(makeMember(OWNER_ID, 'OWNER')) // requester check
      .mockResolvedValueOnce(null); // target check
    const svc = makeService(prisma);

    await expect(svc.updateMemberRole(CONV_ID, OWNER_ID, MEMBER_ID, 'ADMIN')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws BadRequestException when demoting the only OWNER', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique
      .mockResolvedValueOnce(makeMember(OWNER_ID, 'OWNER')) // assertOwner
      .mockResolvedValueOnce(makeMember(ADMIN_ID, 'OWNER')); // target (also OWNER)
    prisma.conversationMember.count.mockResolvedValue(1); // only 1 OWNER
    const svc = makeService(prisma);

    await expect(svc.updateMemberRole(CONV_ID, OWNER_ID, ADMIN_ID, 'MEMBER')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('allows demoting an OWNER when multiple OWNERs exist', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique
      .mockResolvedValueOnce(makeMember(OWNER_ID, 'OWNER')) // assertOwner
      .mockResolvedValueOnce(makeMember(ADMIN_ID, 'OWNER')); // target
    prisma.conversationMember.count.mockResolvedValue(2); // 2 OWNERs
    prisma.conversationMember.update.mockResolvedValue(makeMember(ADMIN_ID, 'MEMBER'));
    const svc = makeService(prisma);

    await expect(
      svc.updateMemberRole(CONV_ID, OWNER_ID, ADMIN_ID, 'MEMBER'),
    ).resolves.not.toThrow();
  });
});

describe('ConversationsService.removeMember', () => {
  it('throws BadRequestException when removing the only OWNER', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique
      .mockResolvedValueOnce(makeMember(OWNER_ID, 'OWNER')) // assertAdminOrOwner skipped (self)
      .mockResolvedValueOnce(makeMember(OWNER_ID, 'OWNER')); // target lookup
    prisma.conversationMember.count.mockResolvedValue(1);
    const svc = makeService(prisma);

    await expect(svc.removeMember(CONV_ID, OWNER_ID, OWNER_ID)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('allows a member to remove themselves', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(makeMember(MEMBER_ID, 'MEMBER'));
    prisma.conversationMember.delete.mockResolvedValue({});
    prisma.message.create.mockResolvedValue({
      id: BigInt(1),
      conversationId: CONV_ID,
      senderId: MEMBER_ID,
      type: 'SYSTEM',
      content: null,
      metadata: {},
      createdAt: new Date(),
      sender: {},
    });
    const svc = makeService(prisma);

    await expect(svc.removeMember(CONV_ID, MEMBER_ID, MEMBER_ID)).resolves.not.toThrow();
  });

  it('throws ForbiddenException when a MEMBER tries to remove someone else', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(makeMember(MEMBER_ID, 'MEMBER'));
    const svc = makeService(prisma);

    await expect(svc.removeMember(CONV_ID, MEMBER_ID, ADMIN_ID)).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('ConversationsService.updateGroup', () => {
  it('throws ForbiddenException when requester is MEMBER', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(makeMember(MEMBER_ID, 'MEMBER'));
    const svc = makeService(prisma);

    await expect(svc.updateGroup(CONV_ID, MEMBER_ID, { name: 'New Name' })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows ADMIN to update group info', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(makeMember(ADMIN_ID, 'ADMIN'));
    prisma.conversation.update.mockResolvedValue({
      id: CONV_ID,
      name: 'New Name',
      description: null,
      members: [],
    });
    const svc = makeService(prisma);

    await expect(svc.updateGroup(CONV_ID, ADMIN_ID, { name: 'New Name' })).resolves.not.toThrow();
  });

  it('strips HTML tags from name and description', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(makeMember(ADMIN_ID, 'ADMIN'));
    let capturedData: Record<string, unknown> = {};
    prisma.conversation.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      capturedData = data;
      return Promise.resolve({
        id: CONV_ID,
        name: data.name,
        description: data.description,
        members: [],
      });
    });
    const svc = makeService(prisma);

    await svc.updateGroup(CONV_ID, ADMIN_ID, {
      name: '<b>Team</b>',
      description: '<script>xss</script>Notes',
    });

    expect(capturedData.name).toBe('Team');
    expect(capturedData.description).toBe('Notes');
  });
});

describe('ConversationsService.addMember', () => {
  it('throws BadRequestException when targetUserId does not exist (P2003)', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(makeMember(ADMIN_ID, 'ADMIN'));
    prisma.conversationMember.create.mockRejectedValue(makeFkError('P2003'));
    const svc = makeService(prisma);

    await expect(svc.addMember(CONV_ID, ADMIN_ID, 'nonexistent-user-uuid')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException when targetUserId is already a member (P2002)', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(makeMember(ADMIN_ID, 'ADMIN'));
    prisma.conversationMember.create.mockRejectedValue(makeFkError('P2002'));
    const svc = makeService(prisma);

    await expect(svc.addMember(CONV_ID, ADMIN_ID, MEMBER_ID)).rejects.toThrow(BadRequestException);
  });

  it('re-throws unexpected non-Prisma errors', async () => {
    const prisma = makePrisma();
    prisma.conversationMember.findUnique.mockResolvedValue(makeMember(ADMIN_ID, 'ADMIN'));
    prisma.conversationMember.create.mockRejectedValue(new Error('unexpected db error'));
    const svc = makeService(prisma);

    await expect(svc.addMember(CONV_ID, ADMIN_ID, 'some-uuid')).rejects.toThrow(
      'unexpected db error',
    );
  });
});

describe('ConversationsService.create', () => {
  it('strips HTML from name and description', async () => {
    const prisma = makePrisma();
    let capturedData: Record<string, unknown> = {};
    prisma.conversation.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      capturedData = data;
      return Promise.resolve({
        id: CONV_ID,
        name: data.name,
        description: data.description,
        members: [],
      });
    });
    const svc = makeService(prisma);

    await svc.create(OWNER_ID, {
      type: 'GROUP' as const,
      name: '<em>Chat</em>',
      description: '<b>desc</b>',
    });

    expect(capturedData.name).toBe('Chat');
    expect(capturedData.description).toBe('desc');
  });

  it('throws BadRequestException when memberIds contain non-existent users (P2003)', async () => {
    const prisma = makePrisma();
    prisma.conversation.create.mockResolvedValue({
      id: CONV_ID,
      name: 'x',
      members: [],
    });
    prisma.conversationMember.createMany.mockRejectedValue(makeFkError('P2003'));
    const svc = makeService(prisma);

    await expect(
      svc.create(OWNER_ID, {
        type: 'GROUP' as const,
        name: 'Chat',
        memberIds: ['non-existent-uuid'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('excludes creator own ID from memberIds bulk insert', async () => {
    const prisma = makePrisma();
    prisma.conversation.create.mockResolvedValue({
      id: CONV_ID,
      name: 'x',
      members: [],
    });
    prisma.conversationMember.createMany.mockResolvedValue({ count: 1 });
    prisma.conversation.findUniqueOrThrow.mockResolvedValue({
      id: CONV_ID,
      name: 'x',
      members: [],
    });
    const svc = makeService(prisma);

    await svc.create(OWNER_ID, {
      type: 'GROUP' as const,
      name: 'Chat',
      memberIds: [OWNER_ID, MEMBER_ID],
    });

    const call = prisma.conversationMember.createMany.mock.calls[0][0];
    const insertedIds = call.data.map((d: { userId: string }) => d.userId);
    expect(insertedIds).not.toContain(OWNER_ID);
    expect(insertedIds).toContain(MEMBER_ID);
  });
});
