import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

const authThrottle = {
  default: { ttl: 60000, limit: process.env.NODE_ENV === 'production' ? 10 : 100 },
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // SameSite=Lax assumes frontend and backend share a registrable domain in prod.
  // If they're on separate eTLD+1s, switch to SameSite=None + Secure.
  private setTokenCookies(res: Response, accessToken: string, refreshToken: string): void {
    const secure = process.env.NODE_ENV === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    });
  }

  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User created; auth cookies set' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email or username already taken' })
  @Public()
  @Throttle(authThrottle)
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.register(dto);
    this.setTokenCookies(res, accessToken, refreshToken);
    return { user };
  }

  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, description: 'Authenticated; auth cookies set' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @Public()
  @Throttle(authThrottle)
  @UseGuards(AuthGuard('local'))
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { id, email } = req.user as { id: string; email: string };
    const { accessToken, refreshToken, user } = await this.authService.login(id, email);
    this.setTokenCookies(res, accessToken, refreshToken);
    return { user };
  }

  @ApiOperation({ summary: 'Rotate tokens using the refresh_token cookie' })
  @ApiResponse({ status: 200, description: 'New access and refresh cookies set' })
  @ApiResponse({ status: 401, description: 'Refresh token missing, expired, or already used' })
  @ApiCookieAuth('access_token')
  @Public()
  @Throttle(authThrottle)
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const {
      sub,
      email,
      jti,
      refreshToken: rawToken,
    } = req.user as { sub: string; email: string; jti: string; refreshToken: string };
    const { accessToken, refreshToken } = await this.authService.refresh(sub, email, rawToken, jti);
    this.setTokenCookies(res, accessToken, refreshToken);
    return {};
  }

  @ApiOperation({ summary: 'Revoke refresh token and clear auth cookies' })
  @ApiResponse({ status: 200, description: 'Logged out; cookies cleared' })
  @ApiCookieAuth('access_token')
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @CurrentUser() currentUser: { id: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(currentUser.id);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
    return {};
  }
}
