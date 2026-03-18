import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

interface UseChatSocketConnectionArgs {
  token: string;
  socketURL: string;
  onBeforeDisconnect?: () => void;
  onServerDisconnect?: (reason: string) => void;
  onConnectError?: (message: string) => void;
}

export function useChatSocketConnection({
  token,
  socketURL,
  onBeforeDisconnect,
  onServerDisconnect,
  onConnectError,
}: UseChatSocketConnectionArgs) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    const s = io(socketURL, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    s.on('connect', () => setSocketConnected(true));
    s.on('disconnect', (reason) => {
      setSocketConnected(false);
      onServerDisconnect?.(reason);
    });
    s.on('connect_error', (err: any) => {
      setSocketConnected(false);
      onConnectError?.(err?.message || 'Erro de conexão');
    });
    setSocket(s);

    return () => {
      onBeforeDisconnect?.();
      s.disconnect();
    };
  }, [token, socketURL, onBeforeDisconnect, onServerDisconnect, onConnectError]);

  return { socket, socketConnected };
}

