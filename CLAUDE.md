# CLAUDE.md

Behavioral guidelines cut common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** Guidelines bias toward caution over speed. Trivial tasks: use judgment.

## 1. Think Before Coding

**No assume. No hide confusion. Surface tradeoffs.**

Before implementing:
- State assumptions explicitly. Uncertain → ask.
- Multiple interpretations → present all, don't pick silently.
- Simpler approach exists → say so. Push back when warranted.
- Unclear → stop. Name what confuses. Ask.

## 2. Simplicity First

**Minimum code. Nothing speculative.**

- No features beyond what asked.
- No abstractions for single-use code.
- No unrequested "flexibility" or "configurability".
- No error handling for impossible scenarios.
- 200 lines when 50 works → rewrite.

Ask: "Would senior engineer call this overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what must. Clean only own mess.**

Editing existing code:
- Don't "improve" adjacent code, comments, formatting.
- Don't refactor unbroken things.
- Match existing style even if you'd do different.
- Notice unrelated dead code → mention, don't delete.

When changes create orphans:
- Remove imports/variables/functions YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

Test: every changed line traces directly to user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks to verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make pass"
- "Fix the bug" → "Write test reproducing it, then make pass"
- "Refactor X" → "Ensure tests pass before and after"

Multi-step tasks, state brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong criteria → loop independently. Weak criteria ("make it work") → constant clarification.

---

**Guidelines working if:** fewer unnecessary diff changes, fewer rewrites from overcomplication, clarifying questions before implementation not after mistakes.


## Commands

### Infrastructure

Compose files: `docker-compose.yml` is base. Overlay with one of:
- `docker-compose.backend.dev.yml` — adds backend + exposes DB/Redis ports to host
- `docker-compose.frontend.dev.yml` — adds frontend (hot-reload)
- `docker-compose.prod.yml` — production builds, restart policies, healthchecks

```bash
# Dev — backend + DB + Redis (hot-reload, DB on host :5433)
docker compose -f docker-compose.yml -f docker-compose.backend.dev.yml up -d

# Dev — full stack (backend + frontend + DB + Redis)
docker compose -f docker-compose.yml -f docker-compose.backend.dev.yml -f docker-compose.frontend.dev.yml up -d

# Production — full stack
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Stop (replace up flags with down)
docker compose -f docker-compose.yml -f docker-compose.backend.dev.yml down
docker compose -f docker-compose.yml -f docker-compose.backend.dev.yml -f docker-compose.frontend.dev.yml down
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
```

**Note:** DB data persists in `postgres_data` named volume across restarts. Only `down -v` deletes it.

**Note:** On Windows/WSL2 Docker Desktop, postgres port `5433` binds to `127.0.0.1` inside engine — `docker ps` won't show it but bound. Run migrations via `docker exec` if host can't reach:
```bash
docker exec chat-app-backend-1 npx prisma db push
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

**Module structure:**
- `infra/`: `PrismaModule`, `RedisModule`, `UploadModule`, `CleanupModule`
- `modules/`: `AuthModule`, `UsersModule`, `ConversationsModule`, `MessagesModule`, `ChatModule` (WS gateway), `PresenceModule`
- Cross-cutting: `ConfigModule` (global, Joi-validated env), `EventEmitterModule`, `ThrottlerModule` (HTTP rate-limit), `LoggerModule` (pino), `ScheduleModule`

**Prisma 7 quirks — critical:**
- Datasource block has **no `url` field**. Connection wired at runtime via `@prisma/adapter-pg`: `new PrismaPg({ connectionString: process.env.DATABASE_URL })` in `PrismaService`.
- After every `prisma migrate dev`, run `prisma generate`.
- `prisma.config.ts` at backend root required.

**Auth flow:**
- Global `JwtAuthGuard` protects all routes; opt out with `@Public()`.
- Two JWTs: access (15 min, `JWT_SECRET`) + refresh (7 days, `JWT_REFRESH_SECRET`). Refresh tokens bcrypt-hashed in DB.
- `issueTokens()` signs both, hashes+stores refresh, returns pair.
- Access token returned in the response body; client sends it as `Authorization: Bearer`. Refresh token is an HttpOnly cookie (`refresh_token`, path `/auth/refresh`) — the only auth cookie.

**WebSocket:**
- `ChatGateway` on namespace `/chat` using `@nestjs/websockets` + Socket.io.
- `SocketIoAdapter` (`infra/websocket/`) — default Socket.io adapter, sets CORS from `ConfigService`. Single-instance only; no cross-process pub/sub.
- JWT read from `handshake.auth.token` on `handleConnection`; user attached to `socket.data.userId`.
- Room membership verified server-side on every WS event — never trust client-declared conversation IDs.

**TypeScript imports:** All source imports use `.js` extensions (`import { X } from './foo.js'`). Intentional — NestJS ESM convention.

### Frontend (Next.js 16 App Router)

**Routing:**
- `proxy.ts` (not `middleware.ts`) with `export default function proxy()` — Next.js 16 convention. Must be a default export named `proxy`; a bare named export loads under webpack but crashes Turbopack's dev middleware loader (`adapterFn is not a function`). Protects routes via `ca_authed` cookie.
- Route groups `(auth)` and `(dashboard)` do **not** add path segments.
- `proxy.ts` also mints a per-request CSP nonce and sets `Content-Security-Policy` on every response path (login redirect, authed redirect, pass-through) — required because Next's inline RSC hydration scripts need `'nonce-{value}'`, which can only be generated per-request, not baked into `next.config.ts`. See ADR-010.

**Auth state:**
1. `lib/auth.ts` — `tokenStorage` keeps the access token in an in-memory variable only (lost on reload, re-acquired via `/auth/refresh`). Refresh token is a backend HttpOnly cookie, never stored client-side. See ADR-009.
2. `store/auth.store.ts` — Zustand + persist for `user`, `isAuthenticated`; `setAuth(user, accessToken)` stores the access token and sets `ca_authed=1` non-HttpOnly cookie for middleware route guard.
3. `lib/api.ts` — Axios instance with `withCredentials: true` (for the refresh cookie); request interceptor attaches `Authorization: Bearer`; response interceptor handles 401 → `refreshAccessToken()` → POST `/auth/refresh` → store new access token → retry. `refreshAccessToken()` is exported and shared with `useSocket.ts`'s reconnect path so an expired token doesn't trigger two concurrent refreshes.

**WebSocket:**
- `lib/socket.ts` — singleton `io()` connecting to `NEXT_PUBLIC_WS_URL/chat`, passing the access token via `auth: { token }` (refreshed on each `connectSocket()`); `emitReliable()` wraps emits with an ack timeout and a delivery-failure toast.
- `hooks/useChat.ts` — subscribes to all WS events (`new_message`, `reaction_added/removed`, `member_added/removed`, `group_updated`, `message_read`, `user_typing`, etc.); updates TanStack Query cache.
- `hooks/useSocket.ts` — on server-initiated disconnect (expired token), manually refreshes and reconnects (socket.io's auto-reconnect doesn't fire for that disconnect reason); on any reconnect after a real disconnect, invalidates the `conversations`/`messages` query caches to resync missed events; surfaces gateway `error` events and connection-outage state via `store/toast.store.ts`. See ADR-011.

**Data fetching:** TanStack Query v5, `staleTime: 60_000`. Cursor-based infinite queries for message history.

## Security Notes
- Rate limit WS message events (10/10s per user via Redis sliding window).
- Sanitize message content server-side before storage (`sanitize-html`).
- Never log message content — log userId, conversationId, size only.