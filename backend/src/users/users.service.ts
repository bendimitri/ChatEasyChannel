import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  findByEmail(email: string) {
    return this.usersRepo.findOne({ where: { email } });
  }

  findById(id: number) {
    return this.usersRepo.findOne({ where: { id } });
  }

  async create(email: string, passwordHash: string, displayName?: string) {
    const user = this.usersRepo.create({
      email,
      passwordHash,
      displayName: displayName || email.split('@')[0],
      sessionId: randomUUID(),
    });
    return this.usersRepo.save(user);
  }

  async rotateSession(userId: number) {
    const sessionId = randomUUID();
    await this.usersRepo.update({ id: userId }, { sessionId });
    return sessionId;
  }

  async updateDisplayName(userId: number, displayName: string) {
    await this.usersRepo.update({ id: userId }, { displayName });
    const updated = await this.findById(userId);
    if (!updated) throw new Error('Usuário não encontrado');
    return updated;
  }
}

