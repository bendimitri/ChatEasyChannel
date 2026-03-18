import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './message.entity';
import { User } from '../users/user.entity';
import { Room } from '../rooms/room.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messagesRepo: Repository<Message>,
  ) {}

  async createText(content: string, user: User, room: Room) {
    const message = this.messagesRepo.create({
      content,
      type: 'text',
      imageUrl: null,
      isDeleted: false,
      editedAt: null,
      user,
      room,
    });
    return this.messagesRepo.save(message);
  }

  async createImage(imageUrl: string, caption: string, user: User, room: Room) {
    const message = this.messagesRepo.create({
      content: caption || '',
      type: 'image',
      imageUrl,
      isDeleted: false,
      editedAt: null,
      user,
      room,
    });
    return this.messagesRepo.save(message);
  }

  findById(id: number) {
    return this.messagesRepo.findOne({ where: { id } });
  }

  async editMessage(messageId: number, userId: number, newContent: string) {
    const msg = await this.findById(messageId);
    if (!msg) throw new NotFoundException('Mensagem não encontrada');
    if (msg.user.id !== userId) throw new ForbiddenException('Sem permissão');
    if (msg.isDeleted) throw new ForbiddenException('Mensagem apagada');
    msg.content = newContent;
    msg.editedAt = new Date();
    return this.messagesRepo.save(msg);
  }

  async deleteMessage(messageId: number, userId: number) {
    const msg = await this.findById(messageId);
    if (!msg) throw new NotFoundException('Mensagem não encontrada');
    if (msg.user.id !== userId) throw new ForbiddenException('Sem permissão');
    if (msg.isDeleted) return msg;

    msg.isDeleted = true;
    msg.editedAt = null;
    msg.type = 'text';
    msg.imageUrl = null;
    msg.content = 'Mensagem apagada';
    return this.messagesRepo.save(msg);
  }

  findByRoom(roomId: number, limit = 100) {
    return this.messagesRepo.find({
      where: { room: { id: roomId } },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }
}

