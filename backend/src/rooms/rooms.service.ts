import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './room.entity';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomsRepo: Repository<Room>,
  ) {}

  findAll() {
    return this.roomsRepo.find({
      order: { createdAt: 'ASC' },
    });
  }

  async ensureDefaultRoom() {
    const count = await this.roomsRepo.count();
    if (count > 0) return;
    await this.create('Geral', 'Sala padrão para começar');
  }

  async create(name: string, description?: string) {
    const room = this.roomsRepo.create({ name, description: description || null });
    return this.roomsRepo.save(room);
  }

  findById(id: number) {
    return this.roomsRepo.findOne({ where: { id } });
  }
}

