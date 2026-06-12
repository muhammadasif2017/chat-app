import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConversationsService } from './conversations.service';

const OWNER_ID = 'owner-uuid';
const ADMIN_ID = 'admin-uuid';
const MEMBER_ID = 'member-uuid';
const CONV_ID = 'conv-uuid';

function makeMember(userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') {
  return { conversationId: CONV_ID, userId, role, isMuted: false, lastReadAt: null, joinedAt: new Date() };
}

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
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
      update: jest.fn().mockResolvedValue({ id: CONV_ID, name: 'x', description: null, members: [] }),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    message: {
      create: jest.fn().mockResolvedValue({ id: BigInt(1), conversationId: CONV_ID, senderId: MEMBER_ID, type: 'SYSTEM', content: null, metadata: {}, createdAt: new Date(), sender: {} }),
      count: jest.fn().mockResolvedValue(0),
    },
    ...overrides,
  };
}

function makeService(prismaOverrides = {}) {
  const prisma = makePrisma(prismaOverrides) as any;
  const events = { emit: jest.fn() } as unknown as EventEmitter2;
  return new ConversationsService(prisma, events);
}

describe('ConversationsService.updateMemberRole', () => {
  it('throws ForbiddenException when requester is ADMIN (not OWNER)', async () => {
    const prisma = makePrisma();
    (prisma.conversationMember.findUnique as jest.Mock).mockResolvedValue(makeMember(ADMIN_ID, 'ADMIN'));
    const svc = makeService(prisma as any);

    await expect(
      svc.updateMemberRole(CONV_ID, ADMIN_ID, MEMBER_ID, 'ADMIN'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException when requester tries to change their own role', async () => {
    const prisma = makePrisma();
    (prisma.conversationMember.findUnique as jest.Mock).mockResolvedValue(makeMember(OWNER_ID, 'OWNER'));
    const svc = makeService(prisma as any);

    await expect(
      svc.updateMemberRole(CONV_ID, OWNER_ID, OWNER_ID, 'MEMBER'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when target is not a member', async () => {
    const prisma = makePrisma();
    (prisma.conversationMember.findUnique as jest.Mock)
      .mockResolvedValueOnce(makeMember(OWNER_ID, 'OWNER')) // requester check
      .mockResolvedValueOnce(null);                          // target check
    const svc = makeService(prisma as any);

    await expect(
      svc.updateMemberRole(CONV_ID, OWNER_ID, MEMBER_ID, 'ADMIN'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when demoting the only OWNER', async () => {
    const prisma = makePrisma();
    (prisma.conversationMember.findUnique as jest.Mock)
      .mockResolvedValueOnce(makeMember(OWNER_ID, 'OWNER'))  // assertOwner
      .mockResolvedValueOnce(makeMember(ADMIN_ID, 'OWNER')); // target (also OWNER)
    (prisma.conversationMember.count as jest.Mock).mockResolvedValue(1); // only 1 OWNER
    const svc = makeService(prisma as any);

    await expect(
      svc.updateMemberRole(CONV_ID, OWNER_ID, ADMIN_ID, 'MEMBER'),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows demoting an OWNER when multiple OWNERs exist', async () => {
    const prisma = makePrisma();
    (prisma.conversationMember.findUnique as jest.Mock)
      .mockResolvedValueOnce(makeMember(OWNER_ID, 'OWNER'))  // assertOwner
      .mockResolvedValueOnce(makeMember(ADMIN_ID, 'OWNER')); // target
    (prisma.conversationMember.count as jest.Mock).mockResolvedValue(2); // 2 OWNERs
    (prisma.conversationMember.update as jest.Mock).mockResolvedValue(makeMember(ADMIN_ID, 'MEMBER'));
    const svc = makeService(prisma as any);

    await expect(
      svc.updateMemberRole(CONV_ID, OWNER_ID, ADMIN_ID, 'MEMBER'),
    ).resolves.not.toThrow();
  });
});

describe('ConversationsService.removeMember', () => {
  it('throws BadRequestException when removing the only OWNER', async () => {
    const prisma = makePrisma();
    (prisma.conversationMember.findUnique as jest.Mock)
      .mockResolvedValueOnce(makeMember(OWNER_ID, 'OWNER'))  // assertAdminOrOwner skipped (self)
      .mockResolvedValueOnce(makeMember(OWNER_ID, 'OWNER')); // target lookup
    (prisma.conversationMember.count as jest.Mock).mockResolvedValue(1);
    const svc = makeService(prisma as any);

    await expect(
      svc.removeMember(CONV_ID, OWNER_ID, OWNER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows a member to remove themselves', async () => {
    const prisma = makePrisma();
    (prisma.conversationMember.findUnique as jest.Mock).mockResolvedValue(makeMember(MEMBER_ID, 'MEMBER'));
    (prisma.conversationMember.delete as jest.Mock).mockResolvedValue({});
    (prisma.message.create as jest.Mock).mockResolvedValue({ id: BigInt(1), conversationId: CONV_ID, senderId: MEMBER_ID, type: 'SYSTEM', content: null, metadata: {}, createdAt: new Date(), sender: {} });
    const svc = makeService(prisma as any);

    await expect(
      svc.removeMember(CONV_ID, MEMBER_ID, MEMBER_ID),
    ).resolves.not.toThrow();
  });

  it('throws ForbiddenException when a MEMBER tries to remove someone else', async () => {
    const prisma = makePrisma();
    (prisma.conversationMember.findUnique as jest.Mock).mockResolvedValue(makeMember(MEMBER_ID, 'MEMBER'));
    const svc = makeService(prisma as any);

    await expect(
      svc.removeMember(CONV_ID, MEMBER_ID, ADMIN_ID),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('ConversationsService.updateGroup', () => {
  it('throws ForbiddenException when requester is MEMBER', async () => {
    const prisma = makePrisma();
    (prisma.conversationMember.findUnique as jest.Mock).mockResolvedValue(makeMember(MEMBER_ID, 'MEMBER'));
    const svc = makeService(prisma as any);

    await expect(
      svc.updateGroup(CONV_ID, MEMBER_ID, { name: 'New Name' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows ADMIN to update group info', async () => {
    const prisma = makePrisma();
    (prisma.conversationMember.findUnique as jest.Mock).mockResolvedValue(makeMember(ADMIN_ID, 'ADMIN'));
    (prisma.conversation.update as jest.Mock).mockResolvedValue({ id: CONV_ID, name: 'New Name', description: null, members: [] });
    const svc = makeService(prisma as any);

    await expect(
      svc.updateGroup(CONV_ID, ADMIN_ID, { name: 'New Name' }),
    ).resolves.not.toThrow();
  });
});
