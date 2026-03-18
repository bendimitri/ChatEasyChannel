import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { ValidationPipe, UsePipes } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { UsersService } from '../users/users.service';
import { RoomsService } from '../rooms/rooms.service';
import { MessagesService } from '../messages/messages.service';
import { RoomActionDto } from './dtos/room-action.dto';
import { SendMessageDto } from './dtos/send-message.dto';
import { EditMessageDto } from './dtos/edit-message.dto';
import { DeleteMessageDto } from './dtos/delete-message.dto';

const wsPort = Number(process.env.WS_PORT || '3001');
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_key';
const wsValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

interface JwtPayload {
  sub: string;
  email?: string;
  displayName?: string;
  sid?: string;
}

@WebSocketGateway(wsPort, {
  cors: {
    origin: corsOrigins,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // usuário só pode estar em uma sala por vez
  private clientRooms = new Map<string, number>();

  // anti-spam simples (memória): >5 msgs em 5s bloqueia por 5s
  private rate = new Map<number, { ts: number[]; blockedUntil: number }>();

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
        this.revokeAndDisconnect(client, 'Token ausente. Faça login novamente.');
        return;
      }

      const payload = jwt.verify(token, jwtSecret) as unknown as JwtPayload;
      const user = await this.usersService.findById(Number(payload.sub));
      if (!user) {
        this.revokeAndDisconnect(client, 'Usuário inválido. Faça login novamente.');
        return;
      }
      if (!payload.sid || !user.sessionId || payload.sid !== user.sessionId) {
        this.revokeAndDisconnect(client, 'Sua conta foi aberta em outro dispositivo.');
        return;
      }

      (client as any).user = user;
      client.data.userId = user.id;
      client.data.sessionId = payload.sid;

      // sessão única real: ao conectar uma nova sessão, derruba conexões antigas da mesma conta
      this.disconnectOtherSessions(user.id, client.id);

      const rooms = await this.roomsService.findAll();
      client.emit('roomsOnlineSnapshot', {
        rooms: rooms.map((room) => ({
          roomId: room.id,
          count: this.getRoomUserCount(room.id),
        })),
      });
    } catch (e) {
      this.revokeAndDisconnect(client, 'Sessão inválida. Faça login novamente.');
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
  @UsePipes(wsValidationPipe)
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: RoomActionDto,
  ) {
    const user = await this.ensureClientSessionValid(client);
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

  @SubscribeMessage('leaveRoom')
  @UsePipes(wsValidationPipe)
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: RoomActionDto,
  ) {
    const user = await this.ensureClientSessionValid(client);
    if (!user) return;

    const prevRoomId = this.clientRooms.get(client.id);
    if (!prevRoomId) return;
    if (data.roomId !== prevRoomId) return;

    client.leave(`room_${prevRoomId}`);
    this.clientRooms.delete(client.id);
    this.broadcastRoomUserCount(prevRoomId);
  }

  @SubscribeMessage('sendMessage')
  @UsePipes(wsValidationPipe)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessageDto,
  ) {
    const user = await this.ensureClientSessionValid(client);
    if (!user) return { ok: false, message: 'Não autenticado', clientMessageId: data.clientMessageId };

    const now = Date.now();
    const entry = this.rate.get(user.id) || { ts: [], blockedUntil: 0 };
    if (entry.blockedUntil > now) {
      const payload = {
        ok: false,
        clientMessageId: data.clientMessageId,
        message: 'Spam detectado. Aguarde alguns segundos.',
        retryAfterMs: entry.blockedUntil - now,
      };
      client.emit('sendError', payload);
      this.rate.set(user.id, entry);
      return payload;
    }
    entry.ts = entry.ts.filter((t) => now - t < 5000);
    entry.ts.push(now);
    if (entry.ts.length > 5) {
      entry.blockedUntil = now + 5000;
      this.rate.set(user.id, entry);
      const payload = {
        ok: false,
        clientMessageId: data.clientMessageId,
        message: 'Muitas mensagens em pouco tempo. Aguarde 5 segundos.',
        retryAfterMs: 5000,
      };
      client.emit('sendError', payload);
      return payload;
    }
    this.rate.set(user.id, entry);

    const room = await this.roomsService.findById(data.roomId);
    if (!room) {
      return { ok: false, message: 'Sala não encontrada', clientMessageId: data.clientMessageId };
    }

    try {
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

      return { ok: true, roomId: room.id, message, clientMessageId: data.clientMessageId };
    } catch (e) {
      const payload = {
        ok: false,
        clientMessageId: data.clientMessageId,
        message: 'Falha ao enviar. Tente novamente.',
      };
      client.emit('sendError', payload);
      return payload;
    }
  }

  @SubscribeMessage('editMessage')
  @UsePipes(wsValidationPipe)
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: EditMessageDto,
  ) {
    const user = await this.ensureClientSessionValid(client);
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
  @UsePipes(wsValidationPipe)
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DeleteMessageDto,
  ) {
    const user = await this.ensureClientSessionValid(client);
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
    this.server.emit('roomUserCount', {
      roomId,
      count: this.getRoomUserCount(roomId),
    });
  }

  private getRoomUserCount(roomId: number) {
    const roomName = `room_${roomId}`;
    const room = this.server.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }

  private disconnectOtherSessions(userId: number, currentClientId: string) {
    for (const [socketId, socket] of this.server.sockets.sockets) {
      if (socketId === currentClientId) continue;
      const socketUserId = socket.data?.userId ?? (socket as any).user?.id;
      if (socketUserId !== userId) continue;

      this.revokeAndDisconnect(socket, 'Sua conta foi aberta em outro dispositivo.');
    }
  }

  private async ensureClientSessionValid(client: Socket) {
    const user = (client as any).user;
    if (!user) return null;

    const current = await this.usersService.findById(user.id);
    const socketSid = client.data?.sessionId;
    if (!current || !socketSid || !current.sessionId || current.sessionId !== socketSid) {
      this.revokeAndDisconnect(client, 'Sua sessão foi invalidada por novo login.');
      return null;
    }

    return user;
  }

  private revokeAndDisconnect(client: Socket, message: string) {
    client.emit('sessionRevoked', { message });
    // atraso ligeiramente maior para garantir entrega do evento ao cliente
    setTimeout(() => client.disconnect(true), 250);
  }
}

