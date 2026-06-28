import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { JwtPayload } from './jwt.strategy.js';
import { extractCookie } from '../../../common/utils/extract-cookie.js';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => extractCookie(req?.headers?.cookie, 'refresh_token'),
      ]),
      secretOrKey: config.get<string>('JWT_REFRESH_SECRET')!,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload & { jti: string }) {
    const refreshToken = extractCookie(req?.headers?.cookie, 'refresh_token');
    if (!refreshToken) throw new UnauthorizedException();
    return { ...payload, refreshToken };
  }
}
