import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';

interface UseChatSocketEventsArgs {
  socket: Socket | null;
  onRoomHistory: (payload: any) => void;
  onNewMessage: (payload: any) => void;
  onSendError: (payload: any) => void;
  onMessageUpdated: (payload: any) => void;
  onRoomUserCount: (payload: any) => void;
  onRoomsOnlineSnapshot?: (payload: any) => void;
  onSessionRevoked?: (payload: any) => void;
}

export function useChatSocketEvents({
  socket,
  onRoomHistory,
  onNewMessage,
  onSendError,
  onMessageUpdated,
  onRoomUserCount,
  onRoomsOnlineSnapshot,
  onSessionRevoked,
}: UseChatSocketEventsArgs) {
  useEffect(() => {
    if (!socket) return;

    socket.on('roomHistory', onRoomHistory);
    socket.on('newMessage', onNewMessage);
    socket.on('sendError', onSendError);
    socket.on('messageUpdated', onMessageUpdated);
    socket.on('roomUserCount', onRoomUserCount);
    if (onRoomsOnlineSnapshot) {
      socket.on('roomsOnlineSnapshot', onRoomsOnlineSnapshot);
    }
    if (onSessionRevoked) {
      socket.on('sessionRevoked', onSessionRevoked);
    }

    return () => {
      socket.off('roomHistory', onRoomHistory);
      socket.off('newMessage', onNewMessage);
      socket.off('sendError', onSendError);
      socket.off('messageUpdated', onMessageUpdated);
      socket.off('roomUserCount', onRoomUserCount);
      if (onRoomsOnlineSnapshot) {
        socket.off('roomsOnlineSnapshot', onRoomsOnlineSnapshot);
      }
      if (onSessionRevoked) {
        socket.off('sessionRevoked', onSessionRevoked);
      }
    };
  }, [
    socket,
    onRoomHistory,
    onNewMessage,
    onSendError,
    onMessageUpdated,
    onRoomUserCount,
    onRoomsOnlineSnapshot,
    onSessionRevoked,
  ]);
}

