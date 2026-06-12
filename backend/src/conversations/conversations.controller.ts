import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { CreateDmDto } from './dto/create-dm.dto.js';
import { UpdateGroupDto } from './dto/update-group.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
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

  @Patch(':id')
  updateGroup(
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.conversationsService.updateGroup(conversationId, user.id, dto);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.conversationsService.addMember(conversationId, user.id, dto.userId);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.conversationsService.removeMember(conversationId, user.id, targetUserId);
  }

  @Patch(':id/members/:userId/role')
  updateMemberRole(
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.conversationsService.updateMemberRole(conversationId, user.id, targetUserId, dto.role);
  }
}
