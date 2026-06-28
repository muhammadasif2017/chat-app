import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Users')
@ApiCookieAuth('access_token')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @Get('me')
  getProfile(@CurrentUser() user: { id: string }) {
    return this.usersService.getProfile(user.id);
  }

  @ApiOperation({ summary: 'Update username or avatar URL' })
  @ApiResponse({ status: 200, description: 'Updated profile' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  @Patch('me')
  updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: { username?: string; avatarUrl?: string },
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @ApiOperation({ summary: 'Search users by username (for adding to DMs / groups)' })
  @ApiQuery({ name: 'q', description: 'Username search query', required: false })
  @ApiResponse({ status: 200, description: 'Array of matching users' })
  @Get('search')
  search(@CurrentUser() user: { id: string }, @Query('q') query: string) {
    return this.usersService.search(query ?? '', user.id);
  }
}
