import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
      where: { isDeleted: false },
      order: { createdAt: 'ASC' },
    });
  }

  async ensureDefaultRoom() {
    const count = await this.roomsRepo.count({ where: { isDeleted: false } });
    if (count > 0) return;
    const room = this.roomsRepo.create({
      name: 'Geral',
      description: 'Sala padrão para começar',
      createdByUserId: null,
      isDeleted: false,
    });
    await this.roomsRepo.save(room);
  }

  async create(name: string, description: string | undefined, userId: number) {
    const activeCount = await this.roomsRepo.count({
      where: { createdByUserId: userId, isDeleted: false },
    });
    if (activeCount >= 3) {
      throw new ForbiddenException('Você só pode criar até 3 salas');
    }

    const room = this.roomsRepo.create({
      name,
      description: description || null,
      createdByUserId: userId,
      isDeleted: false,
    });
    try {
      return await this.roomsRepo.save(room);
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        throw new BadRequestException('Já existe uma sala com esse nome');
      }
      throw new BadRequestException('Erro ao criar sala');
    }
  }

  findById(id: number) {
    return this.roomsRepo.findOne({ where: { id, isDeleted: false } });
  }

  async deleteRoom(roomId: number, userId: number, confirmName: string) {
    const room = await this.roomsRepo.findOne({ where: { id: roomId } });
    if (!room || room.isDeleted) throw new NotFoundException('Sala não encontrada');
    if (!room.createdByUserId) throw new ForbiddenException('Esta sala não pode ser apagada');
    if (room.createdByUserId !== userId) throw new ForbiddenException('Sem permissão');
    if (room.name !== confirmName) {
      throw new ForbiddenException('Nome da sala não confere');
    }
    room.isDeleted = true;
    return this.roomsRepo.save(room);
  }
}

