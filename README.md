# ENTERness Chat – FullStack

Projeto de chat em tempo real com:

- `backend`: NestJS + TypeORM + MariaDB + Socket.IO
- `frontend`: React + Vite + Tailwind + shadcn/ui
- `infra`: Docker + Docker Compose

## Documentação

- Ambiente de desenvolvimento: `README.dev.md`
- Ambiente de produção local (subir e usar): `README.prod.md`

## Resumo das mudanças recentes

- Migrations TypeORM para criação das entidades no banco.
- Configuração por variáveis de ambiente (`.env.example` no root, backend e frontend).
- Frontend com base visual shadcn/ui e animações na tela de autenticação.

## Como rodar com Docker

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
