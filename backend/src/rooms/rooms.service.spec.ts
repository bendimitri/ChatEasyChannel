import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoomsService } from './rooms.service';

describe('RoomsService', () => {
  let service: RoomsService;
  const roomsRepo = {
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RoomsService(roomsRepo as any);
  });

  it('deve bloquear criação quando usuário já tem 3 salas', async () => {
    roomsRepo.count.mockResolvedValue(3);

    await expect(service.create('Sala X', '', 99)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deve lançar erro amigável para sala duplicada', async () => {
    roomsRepo.count.mockResolvedValue(0);
    roomsRepo.findOne.mockResolvedValue({ id: 10, name: 'Sala X', isDeleted: false });

    await expect(service.create('Sala X', '', 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deve impedir deletar sala inexistente', async () => {
    roomsRepo.findOne.mockResolvedValue(null);

    await expect(service.deleteRoom(1, 2, 'Sala')).rejects.toBeInstanceOf(NotFoundException);
  });
});

