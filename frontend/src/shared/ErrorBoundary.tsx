import React from 'react';

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Erro de renderização capturado:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-red-950 text-red-50">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-2">Algo deu errado 😓</h1>
            <p className="mb-4">
              Tente recarregar a página. Se o problema continuar, verifique o console
              do navegador.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

