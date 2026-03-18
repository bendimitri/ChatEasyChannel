import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';

const schema = z.discriminatedUnion('mode', [
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

type FormValues = z.infer<typeof schema>;

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { mode: 'login' } as FormValues,
  });

  const mode = watch('mode');

  const onSubmit = async (values: FormValues) => {
    try {
      const baseURL = 'http://localhost:3000';
      if (values.mode === 'login') {
        const res = await axios.post(`${baseURL}/auth/login`, {
          email: values.email,
          password: values.password,
        });
        setAuth(res.data.accessToken, res.data.user);
      } else {
        const res = await axios.post(`${baseURL}/auth/register`, {
          email: values.email,
          password: values.password,
          displayName: values.displayName,
        });
        setAuth(res.data.accessToken, res.data.user);
      }
      navigate('/chat');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao autenticar');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-md bg-slate-800/80 border border-slate-700 rounded-xl p-5 sm:p-8 shadow-xl mx-3">
        <h1 className="text-2xl font-bold mb-6 text-center">ENTERness Chat</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex gap-2 mb-2" aria-label="Modo de autenticação">
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg border text-sm ${
                mode === 'login'
                  ? 'bg-sky-500 border-sky-500 text-white'
                  : 'bg-transparent border-slate-600 text-slate-200'
              }`}
              onClick={() => setValue('mode', 'login' as any)}
            >
              Login
            </button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-lg border text-sm ${
                mode === 'register'
                  ? 'bg-sky-500 border-sky-500 text-white'
                  : 'bg-transparent border-slate-600 text-slate-200'
              }`}
              onClick={() => setValue('mode', 'register' as any)}
            >
              Cadastro
            </button>
          </div>
          <input type="hidden" value={mode} {...register('mode')} />

          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-base"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          {mode === 'register' && (
            <div className="space-y-1">
              <label htmlFor="displayName" className="block text-sm font-medium">
                Nome
              </label>
              <input
                id="displayName"
                type="text"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-base"
                {...register('displayName' as any)}
              />
              {errors.displayName && (
                <p className="text-xs text-red-400">{errors.displayName.message}</p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium">
              Senha
            </label>
            <input
              id="password"
              type="password"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-base"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:bg-sky-700 text-white font-semibold mt-2 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            {isSubmitting
              ? 'Enviando...'
              : mode === 'login'
                ? 'Entrar'
                : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;

