import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '../../store/auth';
import { useNavigate } from 'react-router-dom';
import { API_URL, SOCKET_URL } from '../../lib/env';
import { useChatSocketConnection } from './hooks/useChatSocketConnection';
import { useChatSocketEvents } from './hooks/useChatSocketEvents';

interface Room {
  id: number;
  name: string;
  description?: string | null;
  createdByUserId?: number | null;
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

type PendingStatus = 'queued' | 'sending' | 'failed';

type SendQueueItem =
  | {
      kind: 'text';
      roomId: number;
      clientMessageId: string;
      content: string;
    }
  | {
      kind: 'image';
      roomId: number;
      clientMessageId: string;
      caption: string;
      file: File;
      previewUrl: string;
    };

interface RoomWithCount extends Room {
  onlineCount: number;
}

const baseURL = API_URL;
const socketURL = SOCKET_URL;

const ChatPage: React.FC = () => {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token)!;
  const user = useAuthStore((s) => s.user)!;
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setAuth = useAuthStore((s) => s.setAuth);
  const queryClient = useQueryClient();
  const roomCountsRef = useRef<Record<number, number>>({});
  const unauthorizedHandledRef = useRef(false);

  const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);
  const currentRoomIdRef = useRef<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [pendingMessages, setPendingMessages] = useState<
    { clientMessageId: string; content: string; status: PendingStatus; reason?: string }[]
  >([]);
  const pendingTimers = useRef<Record<string, number>>({});
  const recentSends = useRef<number[]>([]);
  const [spamNotice, setSpamNotice] = useState<string | null>(null);
  const sendQueue = useRef<SendQueueItem[]>([]);
  const sendingRef = useRef(false);

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
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(user.displayName || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    messageId: number | null;
  }>({ open: false, messageId: null });

  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<{
    open: boolean;
    roomId: number | null;
    roomName: string;
    input: string;
  }>({ open: false, roomId: null, roomName: '', input: '' });

  const showNotice = useCallback((message: string, timeoutMs = 3000) => {
    setSpamNotice(message);
    window.setTimeout(() => setSpamNotice(null), timeoutMs);
  }, []);

  const forceLogout = useCallback(
    (message?: string) => {
      if (unauthorizedHandledRef.current) return;
      unauthorizedHandledRef.current = true;
      const finalMessage =
        message || 'Sua sessão foi encerrada. Faça login novamente.';
      sessionStorage.setItem('auth_notice', finalMessage);
      clearAuth();
      navigate('/auth', { replace: true });
    },
    [clearAuth, navigate],
  );

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error?.response?.status === 401) {
          forceLogout('Sua sessão expirou ou foi encerrada. Faça login novamente.');
        }
        return Promise.reject(error);
      },
    );

    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, [forceLogout]);

  const { data: rooms, isLoading: loadingRooms } = useQuery<RoomWithCount[]>({
    queryKey: ['rooms'],
    retry: false,
    queryFn: async () => {
      const res = await axios.get<Room[]>(`${baseURL}/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data.map((r) => ({
        ...r,
        onlineCount: roomCountsRef.current[r.id] ?? 0,
      }));
    },
  });

  const handleRequestDeleteRoom = (room: Room) => {
    setConfirmDeleteRoom({
      open: true,
      roomId: room.id,
      roomName: room.name,
      input: '',
    });
  };

  const handleConfirmDeleteRoom = async () => {
    if (!confirmDeleteRoom.roomId) return;
    if (confirmDeleteRoom.input !== confirmDeleteRoom.roomName) {
      showNotice('Digite exatamente o nome da sala para apagar.', 2500);
      return;
    }
    try {
      await axios.delete(`${baseURL}/rooms/${confirmDeleteRoom.roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { confirmName: confirmDeleteRoom.input },
      });
      if (currentRoomId === confirmDeleteRoom.roomId) {
        handleLeaveRoom();
      }
      await queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setConfirmDeleteRoom({ open: false, roomId: null, roomName: '', input: '' });
    } catch (err: any) {
      showNotice(err.response?.data?.message || 'Erro ao apagar sala');
    }
  };

  const onRoomHistory = useCallback((payload: { roomId: number; messages: Message[] }) => {
    if (payload.roomId === currentRoomIdRef.current) {
      setMessages(payload.messages);
      requestAnimationFrame(() => {
        if (payload.messages.length > 0) {
          virtuosoRef.current?.scrollToIndex({
            index: payload.messages.length - 1,
            align: 'end',
            behavior: 'auto',
          });
        }
      });
    }
  }, []);

  const onNewMessage = useCallback(
    (payload: { roomId: number; message: Message; clientMessageId?: string }) => {
      if (payload.roomId !== currentRoomIdRef.current) return;

      setMessages((prev) => {
        const byId = prev.findIndex((m) => m.id === payload.message.id);
        if (byId >= 0) {
          const copy = prev.slice();
          copy[byId] = payload.message;
          return copy;
        }

        if (!payload.clientMessageId) return [...prev, payload.message];

        const idx = prev.findIndex(
          (m) => m.localClientMessageId === payload.clientMessageId,
        );
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = payload.message;
          return copy;
        }
        return [...prev, payload.message];
      });

      if (isAtBottom) {
        requestAnimationFrame(() => {
          virtuosoRef.current?.scrollToIndex({
            index: 'LAST',
            align: 'end',
            behavior: 'smooth',
          });
        });
      }

      if (payload.clientMessageId) {
        setPendingMessages((prev) =>
          prev.filter((p) => p.clientMessageId !== payload.clientMessageId),
        );
        const t = pendingTimers.current[payload.clientMessageId];
        if (t) {
          window.clearTimeout(t);
          delete pendingTimers.current[payload.clientMessageId];
        }
      }
    },
    [isAtBottom],
  );

  const onSendError = useCallback(
    (payload: { clientMessageId?: string; message: string; retryAfterMs?: number }) => {
      if (!payload.clientMessageId) return;
      setPendingMessages((prev) =>
        prev.map((p) =>
          p.clientMessageId === payload.clientMessageId
            ? { ...p, status: 'failed', reason: payload.message }
            : p,
        ),
      );
      const t = pendingTimers.current[payload.clientMessageId];
      if (t) {
        window.clearTimeout(t);
        delete pendingTimers.current[payload.clientMessageId];
      }
      if (payload.message) {
        showNotice(payload.message);
      }
    },
    [showNotice],
  );

  const onMessageUpdated = useCallback((payload: { roomId: number; message: Message }) => {
    if (payload.roomId !== currentRoomIdRef.current) return;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === payload.message.id);
      if (idx < 0) return prev;
      const copy = prev.slice();
      copy[idx] = payload.message;
      return copy;
    });
  }, []);

  const onRoomUserCount = useCallback(
    (payload: { roomId: number; count: number }) => {
      roomCountsRef.current[payload.roomId] = payload.count;
      queryClient.setQueryData<RoomWithCount[]>(['rooms'], (old) =>
        old
          ? old.map((r) =>
              r.id === payload.roomId ? { ...r, onlineCount: payload.count } : r,
            )
          : old,
      );
    },
    [queryClient],
  );

  const onRoomsOnlineSnapshot = useCallback(
    (payload: { rooms: { roomId: number; count: number }[] }) => {
      if (!payload?.rooms?.length) return;

      payload.rooms.forEach((r) => {
        roomCountsRef.current[r.roomId] = r.count;
      });

      queryClient.setQueryData<RoomWithCount[]>(['rooms'], (old) =>
        old
          ? old.map((room) => ({
              ...room,
              onlineCount: roomCountsRef.current[room.id] ?? 0,
            }))
          : old,
      );
    },
    [queryClient],
  );

  const onSessionRevoked = useCallback(
    (payload: { message?: string }) => {
      forceLogout(payload?.message || 'Sessão encerrada: sua conta entrou em outro dispositivo.');
    },
    [forceLogout],
  );

  const onSocketDisconnectedByServer = useCallback(
    (reason: string) => {
      if (reason !== 'io server disconnect') return;
      forceLogout('Conexão encerrada pelo servidor. Faça login novamente.');
    },
    [forceLogout],
  );

  const onSocketConnectError = useCallback(
    (message: string) => {
      const msg = (message || '').toLowerCase();
      const authLikeError =
        msg.includes('unauthorized') ||
        msg.includes('forbidden') ||
        msg.includes('jwt') ||
        msg.includes('token') ||
        msg.includes('session');
      if (!authLikeError) return;
      forceLogout('Sua sessão foi invalidada. Faça login novamente.');
    },
    [forceLogout],
  );

  const onBeforeSocketDisconnect = useCallback(() => {
    setPendingMessages((prev) =>
      prev.map((p) => ({
        ...p,
        status: 'failed',
        reason: p.reason || 'Conexão reiniciada durante o envio.',
      })),
    );
    Object.values(pendingTimers.current).forEach((t) => window.clearTimeout(t));
    pendingTimers.current = {};
  }, []);

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

  const handleLeaveRoom = () => {
    if (!socket || !currentRoomId) return;
    socket.emit('leaveRoom', { roomId: currentRoomId });
    setCurrentRoomId(null);
    currentRoomIdRef.current = null;
    setMessages([]);
    setEditingId(null);
    setEditingValue('');
    setAttachedImage(null);
    setNewMessage('');
    setPendingMessages([]);
    Object.values(pendingTimers.current).forEach((t) => window.clearTimeout(t));
    pendingTimers.current = {};
    sendQueue.current = [];
    sendingRef.current = false;
  };

  const setPendingStatus = (
    clientMessageId: string,
    status: PendingStatus,
    reason?: string,
  ) => {
    setPendingMessages((prev) =>
      prev.map((p) =>
        p.clientMessageId === clientMessageId ? { ...p, status, reason } : p,
      ),
    );
  };

  const markFailed = (clientMessageId: string, reason: string) => {
    setPendingStatus(clientMessageId, 'failed', reason);
    const t = pendingTimers.current[clientMessageId];
    if (t) {
      window.clearTimeout(t);
      delete pendingTimers.current[clientMessageId];
    }
  };

  const drainQueue = async () => {
    if (sendingRef.current) return;
    if (!socket || !socketConnected) return;
    if (!currentRoomIdRef.current) return;
    if (sendQueue.current.length === 0) return;

    sendingRef.current = true;
    try {
      while (sendQueue.current.length > 0 && socket && socketConnected) {
        const item = sendQueue.current.shift()!;
        setPendingStatus(item.clientMessageId, 'sending');

        pendingTimers.current[item.clientMessageId] = window.setTimeout(() => {
          markFailed(item.clientMessageId, 'Tempo esgotado (sem confirmação do servidor).');
        }, 12000);

        if (item.kind === 'image') {
          try {
            const form = new FormData();
            form.append('file', item.file);
            const res = await axios.post<{ url: string }>(`${baseURL}/uploads/image`, form, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const imageUrl = `${baseURL}${res.data.url}`;

            socket.emit('sendMessage', {
              roomId: item.roomId,
              type: 'image',
              imageUrl,
              content: item.caption,
              clientMessageId: item.clientMessageId,
            });
          } catch (e: any) {
            markFailed(item.clientMessageId, e?.response?.data?.message || 'Falha no upload');
          }
        } else {
          socket.emit('sendMessage', {
            roomId: item.roomId,
            type: 'text',
            content: item.content,
            clientMessageId: item.clientMessageId,
          });
        }
      }
    } finally {
      sendingRef.current = false;
    }
  };

  const { socket, socketConnected } = useChatSocketConnection({
    token,
    socketURL,
    onBeforeDisconnect: onBeforeSocketDisconnect,
    onServerDisconnect: onSocketDisconnectedByServer,
    onConnectError: onSocketConnectError,
  });

  useChatSocketEvents({
    socket,
    onRoomHistory,
    onNewMessage,
    onSendError,
    onMessageUpdated,
    onRoomUserCount,
    onRoomsOnlineSnapshot,
    onSessionRevoked,
  });

  useEffect(() => {
    if (!socketConnected) return;
    window.setTimeout(() => drainQueue(), 0);
  }, [socketConnected]);

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
      showNotice(err.response?.data?.message || 'Erro ao criar sala');
    }
  };

  const handleSend = async () => {
    if (!socket || !currentRoomId) return;
    if (!socketConnected) {
      showNotice('Sem conexão. Aguarde reconectar para enviar.', 2500);
      return;
    }

    const content = newMessage.trim();
    const hasImage = !!attachedImage;
    const hasText = !!content;
    if (!hasImage && !hasText) return;

    // aviso anti-spam no frontend (não bloqueia totalmente, só alerta)
    const now = Date.now();
    recentSends.current = recentSends.current.filter((t) => now - t < 3000);
    recentSends.current.push(now);
    if (recentSends.current.length >= 5) {
      showNotice('Atenção: muitas mensagens em pouco tempo (possível spam).', 2500);
    }

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
        { clientMessageId, content: '[imagem]', status: 'queued' },
      ]);

      // limpa UI imediatamente
      setNewMessage('');
      setAttachedImage(null);
      // ao enviar, desce pro fim
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: 'LAST',
          align: 'end',
          behavior: 'smooth',
        });
      });

      sendQueue.current.push({
        kind: 'image',
        roomId: currentRoomId,
        clientMessageId,
        caption: content,
        file: attachedImage.file,
        previewUrl: attachedImage.previewUrl,
      });
      drainQueue();
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
      setPendingMessages((prev) => [
        ...prev,
        { clientMessageId, content, status: 'queued' },
      ]);
      setNewMessage('');
      // ao enviar, desce pro fim
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: 'LAST',
          align: 'end',
          behavior: 'smooth',
        });
      });

      sendQueue.current.push({ kind: 'text', roomId: currentRoomId, clientMessageId, content });
      drainQueue();
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
    setConfirmDelete({ open: true, messageId: m.id });
  };

  const handlePickImage = () => {
    if (!currentRoomId) return;
    fileInputRef.current?.click();
  };

  const handleAttachImage = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setAttachedImage({ file, previewUrl, name: file.name });
  };

  const saveProfileName = async () => {
    const name = profileName.trim();
    if (name.length < 2) {
      showNotice('Nome deve ter pelo menos 2 caracteres', 2500);
      return;
    }
    try {
      setSavingProfile(true);
      const res = await axios.patch(
        `${baseURL}/users/me`,
        { displayName: name },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setAuth(token, res.data);
      setProfileOpen(false);
    } catch (err: any) {
      showNotice(err.response?.data?.message || 'Erro ao atualizar nome');
    } finally {
      setSavingProfile(false);
    }
  };

  const openProfile = () => {
    setProfileName(user.displayName || '');
    setProfileOpen(true);
  };

  const connectionStatus = useMemo(() => {
    if (socketConnected) return 'Online';
    return 'Reconectando...';
  }, [socketConnected]);

  return (
    <div className="h-[100dvh] flex bg-slate-900 text-slate-50">
      {spamNotice && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[80] px-4 py-2 rounded-full bg-slate-950 border border-slate-700 text-sm shadow-lg">
          {spamNotice}
        </div>
      )}
      {/* Modal de Perfil */}
      {profileOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setProfileOpen(false)}
            aria-label="Fechar perfil"
          />
          <div
            className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Perfil e configurações"
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">Perfil</div>
                <div className="text-xs text-slate-400">Atualize seu nome de usuário</div>
              </div>
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800"
                onClick={() => setProfileOpen(false)}
                aria-label="Fechar"
              >
                Fechar
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-xs text-slate-400">
                Logado como <span className="text-slate-200">{user.email}</span>
              </div>

              <div className="space-y-1">
                <label htmlFor="profileDisplayName" className="block text-sm font-medium">
                  Nome de usuário
                </label>
                <input
                  id="profileDisplayName"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveProfileName();
                    if (e.key === 'Escape') setProfileOpen(false);
                  }}
                  disabled={savingProfile}
                  autoFocus
                />
                <div className="text-xs text-slate-400">Entre 2 e 30 caracteres.</div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 flex gap-2">
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:bg-sky-700 text-white font-semibold"
                onClick={saveProfileName}
                disabled={savingProfile}
                aria-label="Salvar nome"
              >
                {savingProfile ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação customizada (apagar mensagem) */}
      {confirmDelete.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setConfirmDelete({ open: false, messageId: null })}
            aria-label="Fechar confirmação"
          />
          <div
            className="relative w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar exclusão"
          >
            <div className="p-4 border-b border-slate-800">
              <div className="text-lg font-bold">Apagar mensagem?</div>
              <div className="text-sm text-slate-400 mt-1">
                Essa ação não pode ser desfeita.
              </div>
            </div>
            <div className="p-4 flex gap-2">
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold"
                onClick={() => {
                  if (socket && currentRoomId && confirmDelete.messageId) {
                    socket.emit('deleteMessage', {
                      roomId: currentRoomId,
                      messageId: confirmDelete.messageId,
                    });
                  }
                  setConfirmDelete({ open: false, messageId: null });
                }}
                aria-label="Confirmar apagar"
              >
                Apagar
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800"
                onClick={() => setConfirmDelete({ open: false, messageId: null })}
                aria-label="Fechar"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação customizada (apagar sala) */}
      {confirmDeleteRoom.open && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() =>
              setConfirmDeleteRoom({ open: false, roomId: null, roomName: '', input: '' })
            }
            aria-label="Fechar confirmação"
          />
          <div
            className="relative w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar apagar sala"
          >
            <div className="p-4 border-b border-slate-800">
              <div className="text-lg font-bold">Apagar sala?</div>
              <div className="text-sm text-slate-400 mt-1">
                Para confirmar, digite o nome:
                <span className="text-slate-200 font-semibold"> {confirmDeleteRoom.roomName}</span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <label className="sr-only" htmlFor="confirmRoomName">
                Digite o nome da sala
              </label>
              <input
                id="confirmRoomName"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                value={confirmDeleteRoom.input}
                onChange={(e) =>
                  setConfirmDeleteRoom((s) => ({ ...s, input: e.target.value }))
                }
                placeholder="Nome da sala"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
                  onClick={handleConfirmDeleteRoom}
                  disabled={confirmDeleteRoom.input !== confirmDeleteRoom.roomName}
                >
                  Apagar sala
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800"
                  onClick={() =>
                    setConfirmDeleteRoom({ open: false, roomId: null, roomName: '', input: '' })
                  }
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openProfile}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold"
              aria-label="Abrir perfil"
              title="Perfil"
            >
              Perfil
            </button>
            <button
              onClick={() => {
                clearAuth();
                navigate('/auth');
              }}
              className="text-xs px-3 py-2 border border-slate-600 rounded-lg hover:bg-slate-800"
            >
              Sair
            </button>
          </div>
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
                  <div
                    className={`w-full px-4 py-2 flex justify-between items-center hover:bg-slate-800 ${
                      currentRoomId === room.id ? 'bg-slate-800' : ''
                    }`}
                  >
                    <button
                      onClick={() => handleJoinRoom(room.id)}
                      className="flex-1 text-left"
                      aria-label={`Entrar na sala ${room.name}`}
                    >
                      <div className="text-sm font-medium">{room.name}</div>
                      {room.description && (
                        <div className="text-xs text-slate-400">{room.description}</div>
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-200">
                        {room.onlineCount} online
                      </span>
                      {room.createdByUserId === user.id && (
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-100"
                          onClick={() => handleRequestDeleteRoom(room)}
                          aria-label={`Apagar sala ${room.name}`}
                          title="Apagar sala"
                        >
                          Apagar
                        </button>
                      )}
                    </div>
                  </div>
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
          <div className="flex items-center gap-2">
            {currentRoomId && (
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs"
                onClick={handleLeaveRoom}
                aria-label="Sair da sala"
                title="Sair da sala"
              >
                Sair da sala
              </button>
            )}
            <div className="text-xs text-slate-400 hidden sm:block">
              {connectionStatus}
            </div>
          </div>
        </header>

        <section className="flex-1" aria-label="Mensagens">
          {currentRoomId ? (
            <Virtuoso
              ref={virtuosoRef}
              style={{ height: '100%' }}
              data={messages}
              atBottomStateChange={setIsAtBottom}
              followOutput={(atBottom) => (atBottom ? 'smooth' : false)}
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
                const pendingInfo = message.localClientMessageId
                  ? pendingMessages.find((p) => p.clientMessageId === message.localClientMessageId)
                  : undefined;
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
                      {isOwn && !pending && message.id > 0 && editingId !== message.id && (
                        <div className="flex justify-end gap-2 mb-2">
                          {!message.isDeleted && (
                            <>
                              <button
                                type="button"
                                className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/10"
                                onClick={() => startEdit(message)}
                                aria-label="Editar mensagem"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="text-xs px-3 py-1 rounded-full bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 text-red-100"
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
                        <div className="flex gap-2 items-center">
                          <input
                            className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                            className="text-xs px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-semibold"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="text-xs px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800"
                          >
                            Fechar
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
                        <div className="text-[10px] mt-1 text-slate-200 opacity-80">
                          {pendingInfo?.status === 'failed'
                            ? `Falhou: ${pendingInfo.reason || 'Erro'}`
                            : pendingInfo?.status === 'queued'
                              ? 'Na fila...'
                              : 'Enviando...'}
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

