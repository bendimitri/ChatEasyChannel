import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './index.css';
import { useAuthStore, AuthStoreProvider } from './store/auth';
import { ErrorBoundary } from './shared/ErrorBoundary';

const AuthPage = lazy(() => import('./features/auth/AuthPage'));
const ChatPage = lazy(() => import('./features/chat/ChatPage'));

const queryClient = new QueryClient();

function SplashScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(180deg,#020617_0%,#050b16_48%,#02030a_100%)] px-4">
      <img
        src="/splash-screen.svg"
        alt="Splash screen do ENTERness Chat"
        className="w-full max-w-[420px] h-auto select-none"
        draggable={false}
      />
    </div>
  );
}

function PrivateRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.token);
  if (!token) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthStoreProvider>
          <BrowserRouter>
            <Suspense fallback={<SplashScreen />}>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route
                  path="/chat"
                  element={
                    <PrivateRoute>
                      <ChatPage />
                    </PrivateRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/auth" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthStoreProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

