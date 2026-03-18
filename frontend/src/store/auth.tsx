import React, { createContext, useContext } from 'react';
import { create } from 'zustand';

interface User {
  id: number;
  email: string;
  displayName: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

const authStore = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  user:
    typeof window !== 'undefined' && localStorage.getItem('user')
      ? JSON.parse(localStorage.getItem('user') as string)
      : null,
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user });
  },
  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null });
  },
}));

const AuthContext = createContext<typeof authStore | null>(null);

export const AuthStoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <AuthContext.Provider value={authStore}>{children}</AuthContext.Provider>;
};

export function useAuthStore<T>(selector: (state: AuthState) => T): T {
  const store = useContext(AuthContext);
  if (!store) {
    throw new Error('AuthStoreProvider ausente');
  }
  return store(selector);
}

