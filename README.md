# ENTERness Chat – Desafio FullStack

Aplicação FullStack simples, porém completa, para o desafio da ENTERness.

- **Backend**: NestJS + TypeORM + MariaDB + WebSocket (Socket.IO)
- **Frontend**: React + Vite + TailwindCSS + React Query + Zustand
- **Infra**: Docker + Docker Compose

## Como rodar com Docker (mais fácil)

Pré-requisitos:

- Docker instalado
- Docker Desktop rodando (para o `docker compose`)

Passos:

1. No terminal, vá até a pasta raiz do projeto:

   ```bash
   cd "X:\...\Chat React"
   ```

2. Construa e suba os serviços:

   ```bash
   docker compose up --build
   ```

3. Aguarde o banco (`db`) e o backend (`backend`) inicializarem.

4. Acesse o frontend no navegador:

   - `http://localhost:4173`

## Fluxo básico de uso

1. Acesse `http://localhost:4173`.
2. Vá para a tela de **Cadastro** e crie um usuário.
3. Ao cadastrar ou fazer login, o frontend salva o **JWT** e os dados do usuário.
4. Você será redirecionado para a tela de **Chat**.
5. Crie salas pelo próprio frontend, no menu lateral.
6. Clique em uma sala, entre e envie mensagens:
   - As mensagens aparecem imediatamente (optimistic update).
   - O backend salva todas as mensagens no MariaDB.
7. Abra outro navegador/janela, logue com o mesmo ou outro usuário:
   - Verá o **contador de usuários online** na sala.
   - As mensagens chegam **em tempo real** apenas para quem está na mesma sala.

## Resumo das principais decisões

- **Usuário em apenas UMA sala por vez**: simplifica o controle de sockets.
- **JWT no handshake do Socket.IO**: o token é enviado em `auth.token` e validado no `ChatGateway`.
- **Persistência**:
  - `User -> Message` (1:N)
  - `Room -> Message` (1:N)
  - Tudo salvo em MariaDB via TypeORM.
- **Frontend Pro**:
  - **Zustand** para estado global (auth).
  - **React Query** para estado de servidor (salas).
  - **React Hook Form + Zod** para login/cadastro com validação.
  - **Virtual Scroll** com `react-virtuoso` na lista de mensagens.
  - **Skeletons** na lista de salas.
  - **React.lazy + Suspense** nas rotas (`AuthPage` e `ChatPage`).
  - **ErrorBoundary** para evitar tela branca em erro de renderização.

## Onde estudar no código

- **Backend**:
  - `backend/src/app.module.ts` – Conexão com banco e módulos.
  - `backend/src/auth/*` – Login, cadastro, JWT.
  - `backend/src/chat/chat.gateway.ts` – WebSocket + autenticação + mensagens.
  - `backend/src/rooms/*` – Salas e contagem de usuários online.
  - `backend/src/messages/*` – Persistência de mensagens.
- **Frontend**:
  - `frontend/src/store/auth.tsx` – Zustand + persistência de token/usuário.
  - `frontend/src/features/auth/AuthPage.tsx` – Formulário com React Hook Form + Zod.
  - `frontend/src/features/chat/ChatPage.tsx` – Chat em tempo real, virtualização, optimistic updates.
  - `frontend/src/shared/ErrorBoundary.tsx` – Tratamento de erros de UI.

# ENTERness Chat – Desafio FullStack

Aplicação FullStack simples, porém completa, para o desafio da ENTERness.

- **Backend**: NestJS + TypeORM + MariaDB + WebSocket (Socket.IO)
- **Frontend**: React + Vite + TailwindCSS + React Query + Zustand
- **Infra**: Docker + Docker Compose

## Como rodar com Docker (mais fácil)

Pré-requisitos:

- Docker instalado
- Docker Compose instalado

Passos:

1. No terminal, vá até a pasta raiz do projeto:

   ```bash
<<<<<<< HEAD
   cd "c:\...\Chat React"
=======
   cd "c:\Users\...\Chat React"
>>>>>>> a8e0141 (feat: melhorias na interface de chat e correções de bugs)
   ```

2. Construa e suba os serviços:

   ```bash
   docker-compose up --build
   ```

3. Aguarde o banco (`db`) e o backend (`backend`) inicializarem.

4. Acesse o frontend no navegador:

   - `http://localhost:5173`

## Fluxo básico de uso

1. Acesse `http://localhost:5173`.
2. Vá para a tela de **Cadastro** e crie um usuário.
3. Ao cadastrar ou fazer login, o frontend salva o **JWT** e os dados do usuário.
4. Você será redirecionado para a tela de **Chat**.
5. Crie algumas salas via API (ex.: usando Postman) ou ajuste o frontend para criar salas (ponto de extensão).
6. Clique em uma sala, entre e envie mensagens:
   - As mensagens aparecem imediatamente (optimistic update).
   - O backend salva todas as mensagens no MariaDB.
7. Abra outro navegador/janela, logue com o mesmo ou outro usuário:
   - Verá o **contador de usuários online** na sala.
   - As mensagens chegam **em tempo real** apenas para quem está na mesma sala.

## Resumo das principais decisões

- **Usuário em apenas UMA sala por vez**: simplifica o controle de sockets.
- **JWT no handshake do Socket.IO**: o token é enviado em `auth.token` e validado no `ChatGateway`.
- **Persistência**:
  - `User -> Message` (1:N)
  - `Room -> Message` (1:N)
  - Tudo salvo em MariaDB via TypeORM.
- **Frontend Pro**:
  - **Zustand** para estado global (auth).
  - **React Query** para estado de servidor (salas).
  - **React Hook Form + Zod** para login/cadastro com validação.
  - **Virtual Scroll** com `react-virtuoso` na lista de mensagens.
  - **Skeletons** na lista de salas.
  - **React.lazy + Suspense** nas rotas (`AuthPage` e `ChatPage`).
  - **ErrorBoundary** para evitar tela branca em erro de renderização.

## Onde estudar no código

- Backend:
  - `backend/src/app.module.ts` – Conexão com banco e módulos.
  - `backend/src/auth/*` – Login, cadastro, JWT.
  - `backend/src/chat/chat.gateway.ts` – WebSocket + autenticação + mensagens.
  - `backend/src/rooms/*` – Salas e contagem de usuários online.
  - `backend/src/messages/*` – Persistência de mensagens.
- Frontend:
  - `frontend/src/store/auth.tsx` – Zustand + persistência de token/usuário.
  - `frontend/src/features/auth/AuthPage.tsx` – Formulário com React Hook Form + Zod.
  - `frontend/src/features/chat/ChatPage.tsx` – Chat em tempo real, virtualização, optimistic updates.
  - `frontend/src/shared/ErrorBoundary.tsx` – Tratamento de erros de UI.

