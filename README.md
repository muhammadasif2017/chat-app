# Chat App

Real-time chat web application — portfolio project 2.

**Stack:** NestJS 11 · Next.js 15 (App Router) · Socket.io · PostgreSQL · Redis

---

## Quick Start

**Prerequisites:** Node 20+, Docker

```bash
# 1. Start PostgreSQL (5432) + Redis (6379)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env          # fill in DATABASE_URL, JWT_SECRET, etc.
npm install
npx prisma migrate dev
npm run start:dev             # http://localhost:3001

# 3. Frontend (new terminal)
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

---

## Commands

### Infrastructure
| Command | Description |
|---|---|
| `docker compose up -d` | Start PostgreSQL + Redis |
| `docker compose down` | Stop containers |

### Backend (`/backend`)
| Command | Description |
|---|---|
| `npm run start:dev` | Dev server with watch mode (port 3001) |
| `npm run build` | Compile to `dist/` |
| `npx tsc --noEmit` | Type-check only |
| `npm test` | Run unit tests |
| `npm run test:cov` | Tests with coverage report |
| `npx prisma migrate dev --name <name>` | Create + apply migration |
| `npx prisma generate` | Regenerate client after schema change |
| `npx prisma studio` | GUI database browser |

### Frontend (`/frontend`)
| Command | Description |
|---|---|
| `npm run dev` | Next.js dev server (port 3000) |
| `npm run build` | Production build + type-check |
| `npm run lint` | ESLint |

---

## Architecture

```
frontend/   Next.js 15 App Router, TanStack Query, Zustand, Socket.io client
backend/    NestJS 11, Prisma 7 (PostgreSQL), Socket.io, Redis
```

### Backend modules
- **AuthModule** — JWT access + refresh tokens, bcrypt-hashed refresh stored in DB
- **UsersModule** — profile, avatar upload, user search
- **ConversationsModule** — DIRECT / GROUP conversations, member management
- **MessagesModule** — create/edit/delete, file uploads, full-text search
- **ChatGateway** — Socket.io `/chat` namespace, rate-limited WS events
- **PresenceModule** — online/offline/typing state via Redis

### Frontend
- Route groups `(auth)` / `(dashboard)` — no extra path segments
- `proxy.ts` guards dashboard routes via `ca_authed` cookie (Next.js 15 convention)
- `lib/api.ts` — Axios with request/response interceptors for token refresh
- `lib/socket.ts` — singleton Socket.io connection
- `hooks/useChat.ts` — all WS event handlers, updates TanStack Query cache

### Key decisions
See [`docs/decisions/`](docs/decisions/) for Architecture Decision Records.

- [ADR-001](docs/decisions/001-read-receipt-tracking.md) — Read receipt tracking: `lastReadAt` vs per-message `MessageRead` table
- [ADR-002](docs/decisions/002-prisma-adapter-pattern.md) — Prisma runtime adapter: why `schema.prisma` has no `url` field
- [ADR-003](docs/decisions/003-two-jwt-auth.md) — Two-JWT auth with stored, hashed refresh tokens
- [ADR-004](docs/decisions/004-eventemitter2-gateway-decoupling.md) — EventEmitter2 for service-to-gateway WS broadcast decoupling

---

## Features shipped

| Phase | Feature |
|---|---|
| 1–9 | Auth, real-time messaging, presence, DMs |
| 10 | Edit/delete messages, file uploads, message search, profile page |
| 11 | WebSocket security hardening |
| 12 | Group conversations with real-time member management |
| 13 | Read receipts — "Seen by" avatars per message |
