# README de Desenvolvimento

Este guia explica como rodar o projeto para desenvolvimento, com foco em configuração e entendimento.

## 1) Pré-requisitos

- Node.js 20+
- Docker Desktop
- NPM

## 2) Configuração de ambiente

Copie os exemplos e ajuste quando necessário:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

## 3) Rodar com Docker (recomendado)

```bash
docker compose up --build
```

Serviços:

- Frontend: `http://localhost:4173`
- Backend HTTP: `http://localhost:3000`
- WebSocket: `ws://localhost:3001`
- MariaDB: `localhost:3306`

## 4) Migrations TypeORM

As migrations agora são o padrão do projeto.

- No `docker compose`, o backend já executa migration no start:
  - `npm run migration:run`
- Para executar manualmente (dev local com TS):

```bash
cd backend
npm run migration:run:dev
```

## 5) Rodar sem Docker (opcional)

### Banco

Suba apenas o MariaDB via Docker:

```bash
docker compose up db -d
```

### Backend

```bash
cd backend
npm install
npm run build
npm run migration:run
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 6) Onde mexer no código

- Config backend: `backend/src/app.module.ts`, `backend/src/main.ts`
- DataSource/migrations: `backend/src/database`
- Auth UI (shadcn + animações): `frontend/src/features/auth/AuthPage.tsx`
- Chat real-time: `frontend/src/features/chat/ChatPage.tsx`
- UI base shadcn: `frontend/src/components/ui`
