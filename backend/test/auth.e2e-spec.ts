import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  const authServiceMock = {
    login: jest.fn(),
    register: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/auth/login (POST) deve validar payload inválido', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'email-invalido', password: '' })
      .expect(400);
  });

  it('/auth/login (POST) deve responder com token quando válido', async () => {
    authServiceMock.login.mockResolvedValue({
      accessToken: 'token-test',
      user: { id: 1, email: 'a@a.com', displayName: 'A' },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@a.com', password: '123456' })
      .expect(201);

    expect(res.body.accessToken).toBe('token-test');
  });
});

