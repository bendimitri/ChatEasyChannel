import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
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
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<string>('DB_PORT', '3306')),
        username: configService.get<string>('DB_USER', 'root'),
        password: configService.get<string>('DB_PASS', 'root'),
        database: configService.get<string>('DB_NAME', 'chat_app'),
        entities: [User, Room, Message],
        synchronize: false,
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

