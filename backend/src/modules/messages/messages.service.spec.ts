import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessagesService } from './messages.service.js';

const CONV_ID = 'conv-uuid';
const SENDER_ID = 'sender-uuid';
const OTHER_ID = 'other-uuid';
const MSG_ID = '42';

const SENDER_SELECT_SHAPE = { id: true, username: true, avatarUrl: true };

function fakeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: BigInt(MSG_ID),
    conversationId: CONV_ID,
    senderId: SENDER_ID,
    content: 'hello',
    type: 'TEXT',
    isEdited: false,
    isDeleted: false,
    replyToId: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    sender: { id: SENDER_ID, username: 'alice', avatarUrl: null },
    ...overrides,
  };
}

function makePrisma() {
  return {
    message: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(fakeMessage()),
      update: jest.fn().mockResolvedValue(fakeMessage()),
    },
  } as unknown as import('../../infra/prisma/prisma.service.js').PrismaService;
}

type FakePrisma = ReturnType<typeof makePrisma>;

function makeService(prisma: FakePrisma = makePrisma()) {
  return { svc: new MessagesService(prisma), prisma };
}

describe('MessagesService.create', () => {
  it('strips html tags from content before saving', async () => {
    const { svc, prisma } = makeService();
    (prisma.message.create as jest.Mock).mockResolvedValue(fakeMessage({ content: 'click here' }));

    await svc.create(SENDER_ID, {
      conversationId: CONV_ID,
      content: '<script>alert(1)</script>click here',
    });

    const createCall = (prisma.message.create as jest.Mock).mock.calls[0] as [
      { data: { content: string } },
    ];
    expect(createCall[0].data.content).toBe('click here');
  });

  it('strips bold/italic html tags leaving only text', async () => {
    const { svc, prisma } = makeService();

    await svc.create(SENDER_ID, {
      conversationId: CONV_ID,
      content: '<b>bold</b> and <i>italic</i>',
    });

    const createCall = (prisma.message.create as jest.Mock).mock.calls[0] as [
      { data: { content: string } },
    ];
    expect(createCall[0].data.content).toBe('bold and italic');
  });

  it('stores null content when content is empty/absent', async () => {
    const { svc, prisma } = makeService();
    (prisma.message.create as jest.Mock).mockResolvedValue(fakeMessage({ content: null }));

    await svc.create(SENDER_ID, { conversationId: CONV_ID, content: '' });

    const createCall = (prisma.message.create as jest.Mock).mock.calls[0] as [
      { data: { content: string | null } },
    ];
    expect(createCall[0].data.content).toBeNull();
  });

  it('converts replyToId number to BigInt', async () => {
    const { svc, prisma } = makeService();

    await svc.create(SENDER_ID, { conversationId: CONV_ID, content: 'reply', replyToId: 7 });

    const createCall = (prisma.message.create as jest.Mock).mock.calls[0] as [
      { data: { replyToId: bigint } },
    ];
    expect(createCall[0].data.replyToId).toBe(BigInt(7));
  });

  it('passes conversationId and senderId to prisma', async () => {
    const { svc, prisma } = makeService();

    await svc.create(SENDER_ID, { conversationId: CONV_ID, content: 'hi' });

    const createCall = (prisma.message.create as jest.Mock).mock.calls[0] as [
      { data: { conversationId: string; senderId: string } },
    ];
    expect(createCall[0].data.conversationId).toBe(CONV_ID);
    expect(createCall[0].data.senderId).toBe(SENDER_ID);
  });
});

describe('MessagesService.softDelete', () => {
  it('throws NotFoundException when message does not exist', async () => {
    const { svc } = makeService();

    await expect(svc.softDelete(MSG_ID, SENDER_ID)).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when deleting another user message', async () => {
    const { svc, prisma } = makeService();
    (prisma.message.findUnique as jest.Mock).mockResolvedValue(fakeMessage());

    await expect(svc.softDelete(MSG_ID, OTHER_ID)).rejects.toThrow(ForbiddenException);
  });

  it('sets isDeleted=true and nulls content', async () => {
    const { svc, prisma } = makeService();
    (prisma.message.findUnique as jest.Mock).mockResolvedValue(fakeMessage());
    (prisma.message.update as jest.Mock).mockResolvedValue(
      fakeMessage({ isDeleted: true, content: null }),
    );

    await svc.softDelete(MSG_ID, SENDER_ID);

    const updateCall = (prisma.message.update as jest.Mock).mock.calls[0] as [
      { data: { isDeleted: boolean; content: null } },
    ];
    expect(updateCall[0].data.isDeleted).toBe(true);
    expect(updateCall[0].data.content).toBeNull();
  });

  it('passes sender-scoped message to prisma update', async () => {
    const { svc, prisma } = makeService();
    (prisma.message.findUnique as jest.Mock).mockResolvedValue(fakeMessage());

    await svc.softDelete(MSG_ID, SENDER_ID);

    expect(prisma.message.update as jest.Mock).toHaveBeenCalled();
  });
});

describe('MessagesService.update', () => {
  it('throws NotFoundException when message does not exist', async () => {
    const { svc } = makeService();

    await expect(svc.update(MSG_ID, SENDER_ID, 'new content')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when editing another user message', async () => {
    const { svc, prisma } = makeService();
    (prisma.message.findUnique as jest.Mock).mockResolvedValue(fakeMessage());

    await expect(svc.update(MSG_ID, OTHER_ID, 'new content')).rejects.toThrow(ForbiddenException);
  });

  it('sanitizes html in updated content', async () => {
    const { svc, prisma } = makeService();
    (prisma.message.findUnique as jest.Mock).mockResolvedValue(fakeMessage());
    (prisma.message.update as jest.Mock).mockResolvedValue(fakeMessage({ content: 'safe text' }));

    await svc.update(MSG_ID, SENDER_ID, '<b>safe</b> text');

    const updateCall = (prisma.message.update as jest.Mock).mock.calls[0] as [
      { data: { content: string; isEdited: boolean } },
    ];
    expect(updateCall[0].data.content).toBe('safe text');
  });

  it('sets isEdited=true', async () => {
    const { svc, prisma } = makeService();
    (prisma.message.findUnique as jest.Mock).mockResolvedValue(fakeMessage());

    await svc.update(MSG_ID, SENDER_ID, 'updated');

    const updateCall = (prisma.message.update as jest.Mock).mock.calls[0] as [
      { data: { isEdited: boolean } },
    ];
    expect(updateCall[0].data.isEdited).toBe(true);
  });
});

describe('MessagesService.findMany', () => {
  it('returns messages in ascending order (reversed from desc query)', async () => {
    const msgs = [fakeMessage({ id: BigInt(2) }), fakeMessage({ id: BigInt(1) })];
    const { svc, prisma } = makeService();
    (prisma.message.findMany as jest.Mock).mockResolvedValue(msgs);

    const result = await svc.findMany(CONV_ID);

    expect(result.messages[0].id).toBe(BigInt(1));
    expect(result.messages[1].id).toBe(BigInt(2));
  });

  it('returns nextCursor when page is full', async () => {
    const msgs = Array.from({ length: 50 }, (_, i) => fakeMessage({ id: BigInt(50 - i) }));
    const { svc, prisma } = makeService();
    (prisma.message.findMany as jest.Mock).mockResolvedValue(msgs);

    const result = await svc.findMany(CONV_ID, undefined, 50);

    expect(result.nextCursor).toBe(String(msgs[0].id));
  });

  it('returns null nextCursor when page is not full', async () => {
    const { svc, prisma } = makeService();
    (prisma.message.findMany as jest.Mock).mockResolvedValue([fakeMessage()]);

    const result = await svc.findMany(CONV_ID, undefined, 50);

    expect(result.nextCursor).toBeNull();
  });

  it('uses search query and returns null nextCursor', async () => {
    const { svc, prisma } = makeService();
    (prisma.message.findMany as jest.Mock).mockResolvedValue([fakeMessage()]);

    const result = await svc.findMany(CONV_ID, undefined, 50, 'hello');

    expect(result.nextCursor).toBeNull();
    const call = (prisma.message.findMany as jest.Mock).mock.calls[0] as [
      { where: { content: { contains: string } } },
    ];
    expect(call[0].where.content.contains).toBe('hello');
  });

  // suppress unused variable warning for SENDER_SELECT_SHAPE
  void SENDER_SELECT_SHAPE;
});
