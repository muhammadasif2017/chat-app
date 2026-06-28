import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { CreateConversationDto } from './dto/create-conversation.dto.js';
import { CreateDmDto } from './dto/create-dm.dto.js';
import { UpdateGroupDto } from './dto/update-group.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Conversations')
@ApiCookieAuth('access_token')
@Controller('conversations')
export class ConversationsController {
  constructor(private conversationsService: ConversationsService) {}

  @ApiOperation({ summary: 'List all conversations for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Array of conversations with members, lastMessage, and unreadCount',
  })
  @Get()
  findAll(@CurrentUser() user: { id: string }) {
    return this.conversationsService.findAll(user.id);
  }

  @ApiOperation({ summary: 'Create a new group or channel conversation' })
  @ApiResponse({ status: 201, description: 'Conversation created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateConversationDto) {
    return this.conversationsService.create(user.id, dto);
  }

  @ApiOperation({ summary: 'Find or create a direct message conversation with another user' })
  @ApiResponse({ status: 201, description: 'DM conversation returned (existing or newly created)' })
  @Post('dm')
  findOrCreateDm(@CurrentUser() user: { id: string }, @Body() dto: CreateDmDto) {
    return this.conversationsService.findOrCreateDm(user.id, dto);
  }

  @ApiOperation({ summary: 'Update group name or description (owner/admin only)' })
  @ApiResponse({ status: 200, description: 'Group updated' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @Patch(':id')
  updateGroup(
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.conversationsService.updateGroup(conversationId, user.id, dto);
  }

  @ApiOperation({ summary: 'Add a member to a group conversation (owner/admin only)' })
  @ApiResponse({ status: 201, description: 'Member added' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @Post(':id/members')
  addMember(
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.conversationsService.addMember(conversationId, user.id, dto.userId);
  }

  @ApiOperation({ summary: 'Remove a member from a group conversation (owner/admin only)' })
  @ApiResponse({ status: 200, description: 'Member removed' })
  @ApiResponse({ status: 403, description: 'Insufficient role or cannot remove owner' })
  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.conversationsService.removeMember(conversationId, user.id, targetUserId);
  }

  @ApiOperation({ summary: 'Change a member role (owner only)' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 403, description: 'Only the owner can change roles' })
  @Patch(':id/members/:userId/role')
  updateMemberRole(
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.conversationsService.updateMemberRole(
      conversationId,
      user.id,
      targetUserId,
      dto.role,
    );
  }
}
