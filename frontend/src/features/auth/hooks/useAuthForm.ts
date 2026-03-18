import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/auth';
import { API_URL } from '../../../lib/env';

export const authSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('login'),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(6, 'Mínimo de 6 caracteres'),
  }),
  z.object({
    mode: z.literal('register'),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(6, 'Mínimo de 6 caracteres'),
    displayName: z.string().min(2, 'Informe um nome'),
  }),
]);

export type AuthFormValues = z.infer<typeof authSchema>;

export function useAuthForm() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [authError, setAuthError] = useState<string | null>(null);

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { mode: 'login' } as AuthFormValues,
  });

  const mode = form.watch('mode');

  const onSubmit = async (values: AuthFormValues) => {
    setAuthError(null);
    try {
      const endpoint = values.mode === 'login' ? 'login' : 'register';
      const payload =
        values.mode === 'login'
          ? {
              email: values.email,
              password: values.password,
            }
          : {
              email: values.email,
              password: values.password,
              displayName: values.displayName,
            };

      const res = await axios.post(`${API_URL}/auth/${endpoint}`, payload);
      setAuth(res.data.accessToken, res.data.user);
      navigate('/chat');
    } catch (err: any) {
      setAuthError(err.response?.data?.message || 'Erro ao autenticar');
    }
  };

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  return {
    ...form,
    mode,
    onSubmit,
    authError,
    clearAuthError,
  };
}

