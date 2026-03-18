import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Message } from '../messages/message.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  displayName: string | null;

  // sessão única: ao logar, atualiza; tokens antigos ficam inválidos
  @Column({ type: 'varchar', length: 64, nullable: true })
  sessionId: string | null;

  @OneToMany(() => Message, (message) => message.user)
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

