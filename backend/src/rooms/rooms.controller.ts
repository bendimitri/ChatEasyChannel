import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dtos/create-room.dto';

@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  getAll() {
    return this.roomsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto.name, dto.description);
  }
}

