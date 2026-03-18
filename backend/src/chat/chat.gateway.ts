import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { UsersService } from '../users/users.service';
import { RoomsService } from '../rooms/rooms.service';
import { MessagesService } from '../messages/messages.service';

interface JwtPayload {
  sub: string;
  email?: string;
  displayName?: string;
  sid?: string;
}

@WebSocketGateway(3001, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:4173'],
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // usuário só pode estar em uma sala por vez
  private clientRooms = new Map<string, number>();

  constructor(
    private readonly usersService: UsersService,
    private readonly roomsService: RoomsService,
    private readonly messagesService: MessagesService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ||
        (client.handshake.headers['authorization'] as string | undefined)?.replace(
          'Bearer ',
          '',
        );

      if (!token) {
        client.disconnect(true);
        return;
      }

      const secret = process.env.JWT_SECRET || 'super_secret_jwt_key';
      const payload = jwt.verify(token, secret) as unknown as JwtPayload;
      const user = await this.usersService.findById(Number(payload.sub));
      if (!user) {
        client.disconnect(true);
        return;
      }
      if (!payload.sid || !user.sessionId || payload.sid !== user.sessionId) {
        client.disconnect(true);
        return;
      }

      (client as any).user = user;
    } catch (e) {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const prevRoomId = this.clientRooms.get(client.id);
    if (prevRoomId) {
      client.leave(`room_${prevRoomId}`);
      this.clientRooms.delete(client.id);
      this.broadcastRoomUserCount(prevRoomId);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: number },
  ) {
    const user = (client as any).user;
    if (!user) return;

    const room = await this.roomsService.findById(data.roomId);
    if (!room) return;

    const prevRoomId = this.clientRooms.get(client.id);
    if (prevRoomId && prevRoomId !== room.id) {
      client.leave(`room_${prevRoomId}`);
      this.broadcastRoomUserCount(prevRoomId);
    }

    client.join(`room_${room.id}`);
    this.clientRooms.set(client.id, room.id);

    const messages = await this.messagesService.findByRoom(room.id, 200);

    client.emit('roomHistory', {
      roomId: room.id,
      messages,
    });

    this.broadcastRoomUserCount(room.id);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      roomId: number;
      type?: 'text' | 'image';
      content?: string;
      imageUrl?: string;
      clientMessageId?: string;
    },
  ) {
    const user = (client as any).user;
    if (!user) return;

    const room = await this.roomsService.findById(data.roomId);
    if (!room) return;

    const type = data.type || 'text';
    const message =
      type === 'image'
        ? await this.messagesService.createImage(
            data.imageUrl || '',
            data.content || '',
            user,
            room,
          )
        : await this.messagesService.createText(data.content || '', user, room);

    this.server.to(`room_${room.id}`).emit('newMessage', {
      roomId: room.id,
      message,
      clientMessageId: data.clientMessageId,
    });
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: number; messageId: number; content: string },
  ) {
    const user = (client as any).user;
    if (!user) return;

    const room = await this.roomsService.findById(data.roomId);
    if (!room) return;

    const updated = await this.messagesService.editMessage(
      data.messageId,
      user.id,
      data.content || '',
    );

    this.server.to(`room_${room.id}`).emit('messageUpdated', {
      roomId: room.id,
      message: updated,
    });
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { roomId: number; messageId: number },
  ) {
    const user = (client as any).user;
    if (!user) return;

    const room = await this.roomsService.findById(data.roomId);
    if (!room) return;

    const updated = await this.messagesService.deleteMessage(data.messageId, user.id);

    this.server.to(`room_${room.id}`).emit('messageUpdated', {
      roomId: room.id,
      message: updated,
    });
  }

  private broadcastRoomUserCount(roomId: number) {
    const roomName = `room_${roomId}`;
    const room = this.server.sockets.adapter.rooms.get(roomName);
    const count = room ? room.size : 0;

    this.server.emit('roomUserCount', {
      roomId,
      count,
    });
  }
}

