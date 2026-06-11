import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { CreateDmDto } from './dto/create-dm.dto.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@Controller('conversations')
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.conversationsService.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateConversationDto) {
    return this.conversationsService.create(user.id, dto);
  }

  @Post('dm')
  findOrCreateDm(@CurrentUser() user: { id: string }, @Body() dto: CreateDmDto) {
    return this.conversationsService.findOrCreateDm(user.id, dto);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
    @Body('userId') targetUserId: string,
  ) {
    return this.conversationsService.addMember(conversationId, user.id, targetUserId);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.conversationsService.removeMember(conversationId, user.id, targetUserId);
  }
}
