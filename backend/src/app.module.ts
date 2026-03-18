import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/rooms.module';
import { MessagesModule } from './messages/messages.module';
import { ChatModule } from './chat/chat.module';
import { User } from './users/user.entity';
import { Room } from './rooms/room.entity';
import { Message } from './messages/message.entity';
import { AppBootstrap } from './app.bootstrap';
import { UploadsController } from './uploads/uploads.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'mysql',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || 'root',
        database: process.env.DB_NAME || 'chat_app',
        entities: [User, Room, Message],
        synchronize: true, // simples para teste; em produção usar migrations
      }),
    }),
    UsersModule,
    AuthModule,
    RoomsModule,
    MessagesModule,
    ChatModule,
  ],
  controllers: [UploadsController],
  providers: [AppBootstrap],
})
export class AppModule {}

