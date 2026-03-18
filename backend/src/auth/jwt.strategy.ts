import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'super_secret_jwt_key',
    });
  }

  async validate(payload: { sub: number; email: string; sid?: string }) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) return false;
    if (!payload.sid || !user.sessionId || payload.sid !== user.sessionId) {
      return false;
    }
    return { userId: payload.sub, email: payload.email };
  }
}

