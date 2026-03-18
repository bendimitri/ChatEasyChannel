import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    rotateSession: jest.fn(),
  };
  const jwtService = {
    sign: jest.fn().mockReturnValue('token_mock'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(usersService as any, jwtService as any);
  });

  it('deve cadastrar usuário novo', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    usersService.create.mockResolvedValue({
      id: 1,
      email: 'novo@chat.com',
      displayName: 'Novo',
      sessionId: 'sid-1',
    });
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hash123' as never);

    const res = await service.register('novo@chat.com', '123456', 'Novo');

    expect(usersService.create).toHaveBeenCalled();
    expect(jwtService.sign).toHaveBeenCalled();
    expect(res).toEqual({
      accessToken: 'token_mock',
      user: { id: 1, email: 'novo@chat.com', displayName: 'Novo' },
    });
  });

  it('não deve cadastrar e-mail duplicado', async () => {
    usersService.findByEmail.mockResolvedValue({ id: 10 });

    await expect(service.register('dup@chat.com', '123456', 'Dup')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('deve bloquear login com senha inválida', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 2,
      email: 'user@chat.com',
      displayName: 'User',
      passwordHash: 'hash-antigo',
    });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    await expect(service.login('user@chat.com', 'senha-ruim')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

