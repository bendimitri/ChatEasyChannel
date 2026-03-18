import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Message } from '../messages/message.entity';
import { Room } from '../rooms/room.entity';
import { User } from '../users/user.entity';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'root',
  database: process.env.DB_NAME || 'chat_app',
  entities: [User, Room, Message],
  migrations: [__dirname + '/migrations/*.{js,ts}'],
  synchronize: false,
});
