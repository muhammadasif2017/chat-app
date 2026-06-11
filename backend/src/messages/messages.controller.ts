import { Controller, Get, Param, Query } from '@nestjs/common';
import { MessagesService } from './messages.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ConversationsService } from '../conversations/conversations.service.js';
import { ForbiddenException } from '@nestjs/common';

@Controller('conversations/:id/messages')
export class MessagesController {
  constructor(
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
  ) {}

  @Get()
  async findMany(
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    const isMember = await this.conversationsService.isMember(conversationId, user.id);
    if (!isMember) throw new ForbiddenException();
    return this.messagesService.findMany(conversationId, cursor, limit ? parseInt(limit) : 50, q);
  }
}
