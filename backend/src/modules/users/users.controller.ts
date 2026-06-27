import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getProfile(@CurrentUser() user: { id: string }) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: { username?: string; avatarUrl?: string },
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get('search')
  search(@CurrentUser() user: { id: string }, @Query('q') query: string) {
    return this.usersService.search(query ?? '', user.id);
  }
}
