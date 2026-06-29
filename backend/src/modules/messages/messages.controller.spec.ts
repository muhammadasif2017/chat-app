import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { ConversationsService } from '../conversations/conversations.service.js';

const USER = { id: 'user-uuid' };
const CONV_ID = 'conv-uuid';

function makeController(isMember = true) {
  const messages = {
    findMany: jest.fn().mockResolvedValue({ data: [], nextCursor: null }),
  } as unknown as MessagesService;
  const conversations = {
    isMember: jest.fn().mockResolvedValue(isMember),
  } as unknown as ConversationsService;
  return { ctrl: new MessagesController(messages, conversations), messages, conversations };
}

describe('MessagesController.findMany', () => {
  it('throws ForbiddenException when user is not a member', async () => {
    const { ctrl } = makeController(false);
    await expect(ctrl.findMany(USER, CONV_ID)).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException for non-numeric cursor', async () => {
    const { ctrl } = makeController();
    await expect(ctrl.findMany(USER, CONV_ID, 'abc')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when search query exceeds 100 characters', async () => {
    const { ctrl } = makeController();
    await expect(
      ctrl.findMany(USER, CONV_ID, undefined, undefined, 'x'.repeat(101)),
    ).rejects.toThrow(BadRequestException);
  });

  it('defaults limit to 50 when limit is not a valid number', async () => {
    const { ctrl, messages } = makeController();
    await ctrl.findMany(USER, CONV_ID, undefined, 'notanumber');
    expect(messages.findMany as jest.Mock).toHaveBeenCalledWith(CONV_ID, undefined, 50, undefined);
  });

  it('clamps limit to 100 when limit exceeds maximum', async () => {
    const { ctrl, messages } = makeController();
    await ctrl.findMany(USER, CONV_ID, undefined, '200');
    expect(messages.findMany as jest.Mock).toHaveBeenCalledWith(CONV_ID, undefined, 100, undefined);
  });

  it('passes numeric cursor string and parsed limit to service', async () => {
    const { ctrl, messages } = makeController();
    await ctrl.findMany(USER, CONV_ID, '42', '10', 'hello');
    expect(messages.findMany as jest.Mock).toHaveBeenCalledWith(CONV_ID, '42', 10, 'hello');
  });
});
