# README de Produção (uso rápido)

Objetivo: clonar o projeto, subir com Docker Compose e usar imediatamente.

## 1) Pré-requisitos

- Docker Desktop instalado e aberto

## 2) Clonar

```bash
git clone https://github.com/bendimitri/ChatEasyChannel.git
cd ChatEasyChannel
```

## 3) Configuração mínima

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## 4) Subir tudo

```bash
docker compose up --build
```

Pronto. A aplicação ficará disponível em:

- Frontend: `http://localhost:4173`

> O backend já executa as migrations automaticamente ao iniciar.
