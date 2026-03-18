import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Room } from '../rooms/room.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 16, default: 'text' })
  type: 'text' | 'image';

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @Column({ type: 'datetime', nullable: true })
  editedAt: Date | null;

  @ManyToOne(() => User, (user) => user.messages, { eager: true })
  user: User;

  @ManyToOne(() => Room, (room) => room.messages, { eager: true })
  room: Room;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

