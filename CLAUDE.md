# CLAUDE.md

## Commands

### Infrastructure
```bash
docker compose up -d          # start PostgreSQL (5432) + Redis (6379)
docker compose down           # stop containers
```

### Backend (`/backend`)
```bash
npm run start:dev             # watch mode on :3001
npm run build                 # compile to dist/
npx tsc --noEmit              # type check only
npx prisma migrate dev --name <name>   # create + apply migration
npx prisma generate           # regenerate client after schema change
npx prisma studio             # GUI DB browser
```

### Frontend (`/frontend`)
```bash
npm run dev                   # Next.js dev server on :3000
npm run build                 # production build
npm run lint                  # ESLint
```

## Architecture

### Backend (NestJS 11)

**Module structure:** `AppModule` → `PrismaModule` (global), `AuthModule`, `UsersModule`, `ConversationsModule`, `MessagesModule`, `PresenceModule`.

**Prisma 7 quirks — critical:**
- The datasource block has **no `url` field**. Connection wired at runtime via `@prisma/adapter-pg`: `new PrismaPg({ connectionString: process.env.DATABASE_URL })` in `PrismaService`.
- After every `prisma migrate dev`, run `prisma generate`.
- `prisma.config.ts` at the backend root is required.

**Auth flow:**
- Global `JwtAuthGuard` protects all routes; opt out with `@Public()`.
- Two JWTs: access (15 min, `JWT_SECRET`) + refresh (7 days, `JWT_REFRESH_SECRET`). Refresh tokens are bcrypt-hashed in DB.
- `issueTokens()` signs both tokens, hashes+stores refresh, returns the pair.

**WebSocket:**
- `ChatGateway` on namespace `/chat` using `@nestjs/websockets` + Socket.io.
- Redis adapter (`@socket.io/redis-adapter`) via `RedisIoAdapter` for multi-instance pub/sub.
- JWT validated on `handleConnection` from `socket.handshake.auth.token`; user attached to `socket.data.user`.
- Room membership verified server-side on every WS event — never trust client-declared conversation IDs.

**TypeScript imports:** All source imports use `.js` extensions (`import { X } from './foo.js'`). Intentional — NestJS ESM convention.

### Frontend (Next.js 15 App Router)

**Routing:**
- `proxy.ts` (not `middleware.ts`) with `export function proxy()` — Next.js 15 convention. Protects routes via `ca_authed` cookie.
- Route groups `(auth)` and `(dashboard)` do **not** add path segments.

**Auth state:**
1. `lib/auth.ts` — `tokenStorage` reads/writes `localStorage` keys `ca_access` / `ca_refresh`.
2. `store/auth.store.ts` — Zustand + persist for `user`, `isAuthenticated`, and `ca_authed` cookie.
3. `lib/api.ts` — Axios instance: request interceptor attaches Bearer token; response interceptor handles 401 → refresh → retry.

**WebSocket:**
- `lib/socket.ts` — singleton `io()` connecting to `NEXT_PUBLIC_WS_URL/chat` with `auth: { token }`.
- `hooks/useChat.ts` — subscribes to `new_message`, `user_online`, `user_offline`, `user_typing`; updates TanStack Query cache.

**Data fetching:** TanStack Query v5, `staleTime: 60_000`. Cursor-based infinite queries for message history.

## Security Notes
- Rate limit WS message events (10/10s per user via Redis sliding window).
- Sanitize message content server-side before storage (`sanitize-html`).
- Never log message content — log userId, conversationId, size only.
