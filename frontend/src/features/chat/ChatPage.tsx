import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { io, Socket } from 'socket.io-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../../store/auth';
import { useNavigate } from 'react-router-dom';

interface Room {
  id: number;
  name: string;
  description?: string | null;
}

interface Message {
  id: number;
  content: string;
  type?: 'text' | 'image';
  imageUrl?: string | null;
  isDeleted?: boolean;
  editedAt?: string | null;
  user: { id: number; email: string; displayName: string };
  createdAt: string;
  localClientMessageId?: string;
}

interface RoomWithCount extends Room {
  onlineCount: number;
}

const baseURL = 'http://localhost:3000';
const socketURL = 'http://localhost:3001';

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const user = useAuthStore((s) => s.user)!;
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const queryClient = useQueryClient();

  const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);
  const currentRoomIdRef = useRef<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<
    { clientMessageId: string; content: string }[]
  >([]);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachedImage, setAttachedImage] = useState<{
    file: File;
    previewUrl: string;
    name: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const { data: rooms, isLoading: loadingRooms } = useQuery<RoomWithCount[]>({
    queryKey: ['rooms'],
    queryFn: async () => {
      const res = await axios.get<Room[]>(`${baseURL}/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.map((r) => ({ ...r, onlineCount: 0 }));
    },
  });

  useEffect(() => {
    const s = io(socketURL, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    s.on('connect', () => setSocketConnected(true));
    s.on('disconnect', () => setSocketConnected(false));

    s.on('roomHistory', (payload: { roomId: number; messages: Message[] }) => {
      if (payload.roomId === currentRoomIdRef.current) {
        setMessages(payload.messages);
      }
    });

    s.on(
      'newMessage',
      (payload: { roomId: number; message: Message; clientMessageId?: string },
    ) => {
      if (payload.roomId === currentRoomIdRef.current) {
        setMessages((prev) => {
          if (!payload.clientMessageId) return [...prev, payload.message];

          const idx = prev.findIndex(
            (m) => m.localClientMessageId === payload.clientMessageId,
          );

          // Se for confirmação da nossa mensagem otimista: substitui.
          if (idx >= 0) {
            const copy = prev.slice();
            copy[idx] = payload.message;
            return copy;
          }

          // Se não achou (ex: outra aba), apenas adiciona.
          return [...prev, payload.message];
        });

        if (payload.clientMessageId) {
          setPendingMessages((prev) =>
            prev.filter((p) => p.clientMessageId !== payload.clientMessageId),
          );
        }
      }
    });

    s.on('messageUpdated', (payload: { roomId: number; message: Message }) => {
      if (payload.roomId !== currentRoomIdRef.current) return;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === payload.message.id);
        if (idx < 0) return prev;
        const copy = prev.slice();
        copy[idx] = payload.message;
        return copy;
      });
    });

    s.on('roomUserCount', (payload: { roomId: number; count: number }) => {
      queryClient.setQueryData<RoomWithCount[]>(['rooms'], (old) =>
        old
          ? old.map((r) =>
              r.id === payload.roomId ? { ...r, onlineCount: payload.count } : r,
            )
          : old,
      );
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [token, queryClient]);

  const handleJoinRoom = (roomId: number) => {
    if (!socket) return;
    setCurrentRoomId(roomId);
    currentRoomIdRef.current = roomId;
    setMessages([]);
    setEditingId(null);
    setEditingValue('');
    setMobileSidebarOpen(false);
    socket.emit('joinRoom', { roomId });
  };

  const handleCreateRoom = async () => {
    const name = newRoomName.trim();
    if (!name) return;
    try {
      await axios.post(
        `${baseURL}/rooms`,
        { name },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setNewRoomName('');
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao criar sala');
    }
  };

  const handleSend = async () => {
    if (!socket || !currentRoomId) return;

    const content = newMessage.trim();
    const hasImage = !!attachedImage;
    const hasText = !!content;
    if (!hasImage && !hasText) return;

    // Se tem imagem anexada: envia UMA mensagem do tipo image (com legenda opcional).
    if (hasImage && attachedImage) {
      const clientMessageId = `${Date.now()}-${Math.random()}`;

      const optimistic: Message = {
        id: -Math.floor(Math.random() * 1000000),
        content: content,
        type: 'image',
        imageUrl: attachedImage.previewUrl,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
        createdAt: new Date().toISOString(),
        localClientMessageId: clientMessageId,
      };
      setMessages((prev) => [...prev, optimistic]);
      setPendingMessages((prev) => [
        ...prev,
        { clientMessageId, content: '[imagem]' },
      ]);

      // limpa UI imediatamente
      setNewMessage('');
      setAttachedImage(null);

      try {
        const form = new FormData();
        form.append('file', attachedImage.file);
        const res = await axios.post<{ url: string }>(`${baseURL}/uploads/image`, form, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const imageUrl = `${baseURL}${res.data.url}`;
        socket.emit('sendMessage', {
          roomId: currentRoomId,
          type: 'image',
          imageUrl,
          content, // legenda
          clientMessageId,
        });
      } catch (err: any) {
        alert(err.response?.data?.message || 'Erro ao enviar imagem');
        setPendingMessages((prev) =>
          prev.filter((p) => p.clientMessageId !== clientMessageId),
        );
      }
      return;
    }

    // Sem imagem: envia texto normal
    if (hasText) {
      const clientMessageId = `${Date.now()}-${Math.random()}`;

      const optimistic: Message = {
        id: -Math.floor(Math.random() * 1000000),
        content,
        type: 'text',
        imageUrl: null,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
        },
        createdAt: new Date().toISOString(),
        localClientMessageId: clientMessageId,
      };
      setMessages((prev) => [...prev, optimistic]);
      setPendingMessages((prev) => [...prev, { clientMessageId, content }]);
      setNewMessage('');

      socket.emit('sendMessage', {
        roomId: currentRoomId,
        type: 'text',
        content,
        clientMessageId,
      });
    }
  };

  const startEdit = (m: Message) => {
    if (!currentRoomId || !socketConnected) return;
    if (m.user.id !== user.id) return;
    if (m.isDeleted) return;
    setEditingId(m.id);
    setEditingValue(m.content || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const confirmEdit = () => {
    if (!socket || !currentRoomId || editingId == null) return;
    const content = editingValue.trim();
    socket.emit('editMessage', { roomId: currentRoomId, messageId: editingId, content });
    cancelEdit();
  };

  const deleteMsg = (m: Message) => {
    if (!socket || !currentRoomId) return;
    if (m.user.id !== user.id) return;
    if (m.isDeleted) return;
    if (!confirm('Apagar esta mensagem?')) return;
    socket.emit('deleteMessage', { roomId: currentRoomId, messageId: m.id });
  };

  const handlePickImage = () => {
    if (!currentRoomId) return;
    fileInputRef.current?.click();
  };

  const handleAttachImage = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setAttachedImage({ file, previewUrl, name: file.name });
  };

  const connectionStatus = useMemo(() => {
    if (socketConnected) return 'Online';
    return 'Reconectando...';
  }, [socketConnected]);

  return (
    <div className="h-[100dvh] flex bg-slate-900 text-slate-50">
      {/* overlay mobile */}
      {mobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <aside
        className={`fixed md:static z-50 md:z-auto inset-y-0 left-0 w-80 max-w-[85vw] md:w-72 border-r border-slate-800 bg-slate-900 flex flex-col transform transition-transform duration-200 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        aria-label="Menu lateral"
      >
        <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center">
          <div>
            <div className="text-sm font-semibold">{user.displayName}</div>
            <div className="text-xs text-slate-400">{user.email}</div>
          </div>
          <button
            onClick={() => {
              clearAuth();
              navigate('/auth');
            }}
            className="text-xs px-2 py-1 border border-slate-600 rounded hover:bg-slate-800"
          >
            Sair
          </button>
        </div>
        <div className="px-3 py-2 border-b border-slate-800">
          <label htmlFor="newRoom" className="block text-xs text-slate-400 mb-1">
            Criar sala
          </label>
          <div className="flex gap-2">
            <input
              id="newRoom"
              className="flex-1 px-2 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Ex: Devs"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateRoom();
              }}
            />
            <button
              onClick={handleCreateRoom}
              className="px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold"
            >
              +
            </button>
          </div>
        </div>
        <div className="px-4 py-2 text-xs text-slate-400">Salas</div>
        <div className="flex-1 overflow-y-auto">
          {loadingRooms ? (
            <div className="space-y-2 px-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-lg bg-slate-800/60 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <ul>
              {rooms?.map((room) => (
                <li key={room.id}>
                  <button
                    onClick={() => handleJoinRoom(room.id)}
                    className={`w-full text-left px-4 py-2 flex justify-between items-center hover:bg-slate-800 ${
                      currentRoomId === room.id ? 'bg-slate-800' : ''
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium">{room.name}</div>
                      {room.description && (
                        <div className="text-xs text-slate-400">
                          {room.description}
                        </div>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-200">
                      {room.onlineCount} online
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-800">
          Status: {connectionStatus}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="px-3 md:px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              className="md:hidden px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Abrir menu de salas"
            >
              Salas
            </button>
            <h2 className="font-semibold truncate">
              {currentRoomId
                ? rooms?.find((r) => r.id === currentRoomId)?.name
                : 'Escolha uma sala'}
            </h2>
          </div>
          <div className="text-xs text-slate-400 hidden sm:block">
            {connectionStatus}
          </div>
        </header>

        <section className="flex-1" aria-label="Mensagens">
          {currentRoomId ? (
            <Virtuoso
              style={{ height: '100%' }}
              data={messages}
              components={{
                List: React.forwardRef(function List(props, ref: any) {
                  return (
                    <div
                      ref={ref}
                      {...props}
                      role="log"
                      aria-live="polite"
                      aria-relevant="additions"
                    />
                  );
                }),
              }}
              itemContent={(_, message) => {
                const isOwn = message.user.id === user.id;
                const pending = !!message.localClientMessageId
                  ? pendingMessages.some(
                      (p) => p.clientMessageId === message.localClientMessageId,
                    )
                  : false;
                const align = isOwn ? 'items-end' : 'items-start';
                return (
                  <div
                    className={`px-4 py-1 flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    role="listitem"
                  >
                    <div
                      className={`inline-block max-w-xl px-3 py-2 rounded-lg text-sm ${align} ${
                        isOwn
                          ? 'bg-sky-600 text-white ml-auto'
                          : 'bg-slate-800 text-slate-50'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1 gap-4">
                        <span className="font-semibold text-xs">
                          {message.user.displayName}
                        </span>
                        <span className="text-[10px] text-slate-300">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      {isOwn && !pending && message.id > 0 && (
                        <div className="flex justify-end gap-2 mb-1">
                          {!message.isDeleted && (
                            <>
                              <button
                                type="button"
                                className="text-[10px] underline opacity-90 hover:opacity-100"
                                onClick={() => startEdit(message)}
                                aria-label="Editar mensagem"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="text-[10px] underline opacity-90 hover:opacity-100"
                                onClick={() => deleteMsg(message)}
                                aria-label="Apagar mensagem"
                              >
                                Apagar
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {editingId === message.id ? (
                        <div className="flex gap-2">
                          <input
                            className="flex-1 px-2 py-1 rounded bg-slate-900/50 border border-white/20 text-xs"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            aria-label="Editar texto da mensagem"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={confirmEdit}
                            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <>
                          {message.type === 'image' && message.imageUrl ? (
                            <a
                              href={message.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              <img
                                src={message.imageUrl}
                                alt="Imagem enviada no chat"
                                className="max-h-64 rounded-md border border-white/10"
                              />
                            </a>
                          ) : null}
                          {message.isDeleted ? (
                            <p className="italic opacity-80">{message.content || 'Mensagem apagada'}</p>
                          ) : message.type === 'image' && message.content ? (
                            <p className="whitespace-pre-wrap break-words mt-2">
                              {message.content}
                            </p>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          )}
                          {!!message.editedAt && !message.isDeleted && (
                            <div className="text-[10px] mt-1 opacity-70">(editada)</div>
                          )}
                        </>
                      )}
                      {pending && (
                        <div className="text-[10px] mt-1 text-slate-200 opacity-70">
                          Enviando...
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              Selecione uma sala para começar a conversar.
            </div>
          )}
        </section>

        <footer className="border-t border-slate-800 p-3 flex flex-col sm:flex-row gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAttachImage(file);
              e.currentTarget.value = '';
            }}
          />
          <button
            onClick={handlePickImage}
            disabled={!currentRoomId}
            className="px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40 w-full sm:w-auto"
            aria-label="Anexar imagem"
            title="Anexar imagem"
          >
            Imagem
          </button>
          {attachedImage && (
            <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-700 bg-slate-900">
              <img
                src={attachedImage.previewUrl}
                alt="Pré-visualização da imagem anexada"
                className="h-9 w-9 object-cover rounded"
              />
              <span className="text-xs text-slate-200 max-w-[120px] truncate">
                {attachedImage.name}
              </span>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-slate-600 hover:bg-slate-800"
                onClick={() => setAttachedImage(null)}
                aria-label="Remover imagem anexada"
                title="Remover"
              >
                X
              </button>
            </div>
          )}
          <div className="flex gap-2 w-full">
            <input
              type="text"
              className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder={
                attachedImage
                  ? 'Digite uma legenda (opcional)...'
                  : currentRoomId
                    ? 'Digite sua mensagem...'
                    : 'Escolha uma sala primeiro'
              }
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              disabled={!currentRoomId}
              aria-label="Mensagem"
              inputMode="text"
              autoComplete="off"
            />
            <button
              onClick={handleSend}
              disabled={!currentRoomId || (!newMessage.trim() && !attachedImage)}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 text-white font-semibold whitespace-nowrap"
              aria-label="Enviar mensagem"
            >
              Enviar
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default ChatPage;

