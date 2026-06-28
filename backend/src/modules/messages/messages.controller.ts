import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ConversationsService } from '../conversations/conversations.service.js';
import { ForbiddenException } from '@nestjs/common';

@ApiTags('Messages')
@ApiCookieAuth('access_token')
@Controller('conversations/:id/messages')
export class MessagesController {
  constructor(
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
  ) {}

  @ApiOperation({ summary: 'Fetch messages for a conversation (cursor-based pagination)' })
  @ApiQuery({
    name: 'cursor',
    description: 'Message ID to paginate from (exclusive)',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of messages to return (default 50)',
    required: false,
  })
  @ApiQuery({ name: 'q', description: 'Full-text search query', required: false })
  @ApiResponse({ status: 200, description: 'Paginated messages with nextCursor' })
  @ApiResponse({ status: 403, description: 'Not a member of this conversation' })
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
