export const API_URL =
  import.meta.env.VITE_API_URL?.trim() || 'http://localhost:3000';

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL?.trim() || 'http://localhost:3001';
