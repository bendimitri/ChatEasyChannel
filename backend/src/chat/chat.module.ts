import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { UsersModule } from '../users/users.module';
import { RoomsModule } from '../rooms/rooms.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [UsersModule, RoomsModule, MessagesModule],
  providers: [ChatGateway],
})
export class ChatModule {}

