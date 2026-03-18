import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string, displayName: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new UnauthorizedException('E-mail já cadastrado');
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await this.usersService.create(email, hash, displayName);
    // user já nasce com sessionId
    return this.buildToken(user.id, user.email, user.displayName || '', user.sessionId || '');
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    // sessão única: invalida tokens antigos deste usuário
    const sessionId = await this.usersService.rotateSession(user.id);
    return this.buildToken(user.id, user.email, user.displayName || '', sessionId);
  }

  private buildToken(id: number, email: string, displayName: string, sessionId: string) {
    const payload = { sub: id, email, displayName, sid: sessionId };
    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: {
        id,
        email,
        displayName,
      },
    };
  }
}

