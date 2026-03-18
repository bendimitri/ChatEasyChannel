import { Injectable, OnModuleInit } from '@nestjs/common';
import { RoomsService } from './rooms/rooms.service';

@Injectable()
export class AppBootstrap implements OnModuleInit {
  constructor(private readonly roomsService: RoomsService) {}

  async onModuleInit() {
    await this.roomsService.ensureDefaultRoom();
  }
}

