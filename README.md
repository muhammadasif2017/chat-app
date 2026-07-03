# Chat App

A full-stack real-time chat application built with NestJS, Next.js, and Socket.io.

[![CI](https://github.com/muhammadasif2017/chat-app/actions/workflows/ci.yml/badge.svg)](https://github.com/muhammadasif2017/chat-app/actions/workflows/ci.yml)

---

## Features

- **Real-time messaging** — instant delivery via WebSocket
- **Direct messages** — one-on-one conversations
- **Group conversations** — create groups, manage members and roles (Owner / Admin / Member)
- **Presence** — online / offline indicators and last-seen timestamps
- **Typing indicators** — live "is typing…" signals
- **Read receipts** — "Seen by" avatars per message
- **Message actions** — edit and soft-delete messages
- **Reply threading** — quote any message and reply in-context
- **Emoji reactions** — react with 👍 ❤️ 😂 😮 😢 🎉; click to toggle your own
- **File uploads** — attach images to messages
- **Message search** — case-insensitive content search within any conversation
- **Secure auth** — dual-JWT (access 15 min + refresh 7 days), bcrypt-hashed refresh tokens stored in DB

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, TanStack Query v5, Zustand, Tailwind CSS |
| Backend | NestJS 11, TypeScript, Prisma 7 (PostgreSQL adapter) |
| Real-time | Socket.io (single-instance) |
| Database | PostgreSQL |
| Cache / Presence | Redis |
| Auth | Passport.js, JWT, bcrypt |

---

## Prerequisites

- **Docker** (for the full-stack Docker setup)
- **Node.js** 20+ (for local development only)

---

## Getting Started

### Option A — Docker (recommended)

```bash
git clone https://github.com/muhammadasif2017/chat-app.git
cd chat-app
cp .env.example .env
cp backend/.env.example backend/.env       # set JWT secrets (min 32 chars each)
cp frontend/.env.local.example frontend/.env.local

# Full stack — backend + frontend + DB + Redis
docker compose -f docker-compose.yml \
               -f docker-compose.backend.dev.yml \
               -f docker-compose.frontend.dev.yml up -d

# Apply DB schema on first run
docker exec chat-app-backend-1 npx prisma db push
```

App: http://localhost:3000 · API docs (Swagger): http://localhost:3001/api/docs

### Option B — Local development

#### 1. Start infrastructure

```bash
docker compose up -d postgres redis   # starts PostgreSQL :5433 and Redis :6379
```

#### 2. Backend

```bash
cd backend
cp .env.example .env        # fill in secrets (see Environment Variables below)
npm install
npx prisma migrate dev      # run migrations and generate Prisma client
npm run start:dev           # API server at http://localhost:3001
```

#### 3. Frontend

```bash
cd frontend                 # new terminal
cp .env.local.example .env.local
npm install
npm run dev                 # app at http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `REDIS_URL` | ✅ | — | Redis connection string |
| `JWT_SECRET` | ✅ | — | Access token signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | ✅ | — | Refresh token signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | | `7d` | Refresh token TTL |
| `PORT` | | `3001` | API server port |
| `NODE_ENV` | | `development` | `development` or `production` |
| `FRONTEND_URL` | | `http://localhost:3000` | Allowed CORS origin |

> Generate secrets: `openssl rand -base64 64`

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend base URL (e.g. `http://localhost:3001`) |
| `NEXT_PUBLIC_WS_URL` | ✅ | WebSocket server URL (usually same as API URL) |

---

## Project Structure

```
chat-app/
├── backend/
│   └── src/
│       ├── infra/          # Prisma, Redis, file upload
│       ├── modules/        # Domain modules (auth, users, conversations, messages, chat, presence)
│       ├── config/         # Logger and throttler configuration
│       └── common/         # Guards, decorators, exception filters
├── frontend/
│   └── src/
│       ├── app/            # Pages — App Router (auth) and (dashboard) route groups
│       ├── components/     # UI components
│       ├── hooks/          # useChat, useSocket, usePresence
│       ├── lib/            # API client, socket singleton, auth token storage
│       └── store/          # Zustand auth store
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## Development Commands

### Infrastructure

```bash
docker compose up -d        # start PostgreSQL + Redis
docker compose down         # stop containers
```

### Backend

```bash
npm run start:dev           # dev server with watch mode
npm run build               # compile to dist/
npm run lint                # ESLint
npm run lint:fix            # ESLint with auto-fix
npm run format              # Prettier
npm test                    # unit tests
npm run test:cov            # unit tests with coverage
npx tsc --noEmit            # type-check only
npx prisma migrate dev --name <name>   # create and apply migration
npx prisma generate         # regenerate client after schema change
npx prisma studio           # GUI database browser
```

### Frontend

```bash
npm run dev                 # Next.js dev server
npm run build               # production build
npm test                    # unit tests
npm run lint                # ESLint
npm run lint:fix            # ESLint with auto-fix
npm run format              # Prettier
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Browser  (Next.js 16)                      │
│       TanStack Query v5 · Zustand · Socket.io client         │
└──────────────────┬──────────────────────────┬───────────────┘
                   │ REST / Axios              │ Socket.io
                   │ Bearer JWT               │ JWT on connect
                   ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  NestJS 11  (:3001)                          │
│  ┌──────┐ ┌───────┐ ┌────────────┐ ┌──────────────────┐    │
│  │ Auth │ │ Users │ │  Convos    │ │    Messages      │    │
│  └──────┘ └───────┘ └────────────┘ └──────────────────┘    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Chat Gateway  (/chat)  — JWT auth · room guard ·   │   │
│  │  single-instance Socket.io · 10 events / 10 s / user│   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Presence Service — Redis keys (TTL 30 s) · roster  │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────┬───────────────┘
                        │                     │
              ┌─────────▼──────┐    ┌─────────▼──────────┐
              │  PostgreSQL    │    │       Redis         │
              │  Prisma 7      │    │  Presence ·        │
              │  (pg adapter)  │    │  Rate limit        │
              └────────────────┘    └────────────────────┘
```

### Backend

The API is built with **NestJS** using a layered module structure:

- **`infra/`** — infrastructure adapters: Prisma (DB), Redis (presence/rate-limit cache), file upload (Multer)
- **`modules/auth`** — register, login, token refresh, logout. Two JWTs: short-lived access token + long-lived refresh token (hashed and stored in DB for revocation)
- **`modules/users`** — profile management, user search
- **`modules/conversations`** — DIRECT and GROUP conversations; role-based member management (OWNER / ADMIN / MEMBER)
- **`modules/messages`** — create, edit, soft-delete, cursor-based pagination, content search
- **`modules/chat`** — Socket.io gateway on `/chat` namespace; authenticates connections via JWT, enforces room membership on every event, rate-limits at 10 messages / 10 s per user via Redis
- **`modules/presence`** — Redis-backed online/offline state with heartbeat expiry and typing indicators
- **`config/`** — extracted logger (pino) and throttler configuration

All routes are protected by a global `JwtAuthGuard`; opt out with `@Public()`.

### Frontend

Built on **Next.js 16 App Router** with two route groups:

- **`(auth)`** — login and register pages (public)
- **`(dashboard)`** — all chat UI (protected)

Route protection is handled by `proxy.ts` via the `ca_authed` cookie.

Key patterns:
- **`lib/api.ts`** — Axios instance with request/response interceptors: attaches Bearer token, handles 401 → refresh → retry transparently
- **`lib/socket.ts`** — singleton Socket.io connection; `useSocket` hook manages lifecycle
- **`hooks/useChat.ts`** — subscribes to all WS events and keeps TanStack Query cache in sync (messages, members, presence, read receipts)
- **TanStack Query** — server state with `staleTime: 60s` and cursor-based infinite scroll for message history

---

## Testing

```bash
# Backend — 153 unit tests across 11 suites
cd backend && npm test
cd backend && npm run test:cov   # with coverage

# Frontend — 54 unit tests across 8 suites
cd frontend && npm test
```

---

## Production Deployment

### Database migrations

**Never run `prisma migrate dev` in production** — it creates shadow databases and may prompt interactively.

Use the deploy command instead:

```bash
cd backend
npx prisma migrate deploy   # applies all pending migrations; safe to run on every deploy
```

Run this before starting the new application version. In the Docker setup this happens automatically via the `migrate` service in `docker-compose.yml`.

### Rollback

Prisma does not support automatic schema rollback. If a migration must be reverted:

1. Deploy the previous application version (git revert + redeploy).
2. Write and apply a corrective migration manually (`prisma migrate dev --name revert-xxx` in a dev environment, then deploy the resulting migration file to prod).

### Checklist before first prod deploy

- [ ] Set `NODE_ENV=production` in the backend environment
- [ ] Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET` (≥ 32 chars, generated with `openssl rand -base64 64`)
- [ ] Set `FRONTEND_URL` to your frontend's origin (not `localhost`)
- [ ] Run `npx prisma migrate deploy` before starting the backend
- [ ] Confirm `GET /health` returns `{"status":"ok"}` after startup
- [ ] Confirm Swagger (`/api/docs`) is **not** accessible (disabled when `NODE_ENV=production`)

---

## Contributing

### Commit convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add emoji reactions to messages
fix: prevent duplicate DM conversations
chore: update dependencies
docs: add setup instructions for Redis
```

### Git hooks (Husky + lint-staged)

Pre-commit runs automatically:
- **Backend** — `tsc --noEmit` then `prettier --write` + `eslint --fix` on staged `.ts` files
- **Frontend** — `prettier --write` + `eslint --fix` on staged `.ts`/`.tsx` files

CI runs lint, type-check, and tests on every pull request.

---

## License

MIT
