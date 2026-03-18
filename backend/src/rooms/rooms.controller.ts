import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dtos/create-room.dto';
import { DeleteRoomDto } from './dtos/delete-room.dto';

@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  getAll() {
    return this.roomsService.findAll();
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateRoomDto) {
    return this.roomsService.create(dto.name, dto.description, req.user.userId);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string, @Body() dto: DeleteRoomDto) {
    return this.roomsService.deleteRoom(Number(id), req.user.userId, dto.confirmName);
  }
}

