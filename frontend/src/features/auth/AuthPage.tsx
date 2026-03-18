import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { useAuthForm } from './hooks/useAuthForm';

const AuthPage: React.FC = () => {
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    mode,
    onSubmit,
    authError,
    clearAuthError,
  } = useAuthForm();

  useEffect(() => {
    const notice = sessionStorage.getItem('auth_notice');
    if (!notice) return;
    setAuthNotice(notice);
    sessionStorage.removeItem('auth_notice');
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-100px] top-[-80px] h-72 w-72 rounded-full bg-sky-500/25 blur-3xl animate-blob" />
        <div className="absolute right-[-80px] top-[120px] h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl animate-blob [animation-delay:2s]" />
        <div className="absolute bottom-[-120px] left-[35%] h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl animate-blob [animation-delay:4s]" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/80 bg-card/85 backdrop-blur-md shadow-2xl shadow-black/30">
          <CardHeader className="space-y-3">
            <Badge variant="secondary" className="w-fit">
              Chat em tempo real
            </Badge>
            <CardTitle className="text-2xl">ENTERness Chat</CardTitle>
            <CardDescription>
              Faça login ou cadastre-se para entrar nas salas e conversar.
            </CardDescription>
            {authNotice && (
              <div className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                {authNotice}
              </div>
            )}
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-2" aria-label="Modo de autenticação">
                <Button
                  type="button"
                  variant={mode === 'login' ? 'default' : 'outline'}
                  onClick={() => {
                    clearAuthError();
                    setValue('mode', 'login' as any);
                  }}
                >
                  Login
                </Button>
                <Button
                  type="button"
                  variant={mode === 'register' ? 'default' : 'outline'}
                  onClick={() => {
                    clearAuthError();
                    setValue('mode', 'register' as any);
                  }}
                >
                  Cadastro
                </Button>
              </div>

              <input type="hidden" value={mode} {...register('mode')} />

              {authError && (
                <div className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {authError}
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="email" className="block text-sm font-medium">
                  E-mail
                </label>
                <Input
                  id="email"
                  type="email"
                  className="h-11 text-base"
                  placeholder="voce@email.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>

              {mode === 'register' && (
                <div className="space-y-1 animate-in fade-in-50 slide-in-from-top-1 duration-200">
                  <label htmlFor="displayName" className="block text-sm font-medium">
                    Nome
                  </label>
                  <Input
                    id="displayName"
                    type="text"
                    className="h-11 text-base"
                    placeholder="Seu nome no chat"
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
                <Input
                  id="password"
                  type="password"
                  className="h-11 text-base"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 text-base font-semibold"
              >
                {isSubmitting
                  ? 'Enviando...'
                  : mode === 'login'
                    ? 'Entrar'
                    : 'Criar conta'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;


