# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes m;;''ade unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.


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
- JWT read from `access_token` cookie on `handleConnection`; user attached to `socket.data.userId`.
- Room membership verified server-side on every WS event — never trust client-declared conversation IDs.

**TypeScript imports:** All source imports use `.js` extensions (`import { X } from './foo.js'`). Intentional — NestJS ESM convention.

### Frontend (Next.js 16 App Router)

**Routing:**
- `proxy.ts` (not `middleware.ts`) with `export function proxy()` — Next.js 16 convention. Protects routes via `ca_authed` cookie.
- Route groups `(auth)` and `(dashboard)` do **not** add path segments.

**Auth state:**
1. `lib/auth.ts` — empty; auth tokens are HTTP-only cookies set by the backend. No localStorage.
2. `store/auth.store.ts` — Zustand + persist for `user`, `isAuthenticated`; sets `ca_authed=1` non-HttpOnly cookie for middleware route guard.
3. `lib/api.ts` — Axios instance with `withCredentials: true`; response interceptor handles 401 → POST `/auth/refresh` → retry.

**WebSocket:**
- `lib/socket.ts` — singleton `io()` connecting to `NEXT_PUBLIC_WS_URL/chat` with `withCredentials: true` (sends `access_token` cookie automatically).
- `hooks/useChat.ts` — subscribes to all WS events (`new_message`, `reaction_added/removed`, `member_added/removed`, `group_updated`, `message_read`, `user_typing`, etc.); updates TanStack Query cache.

**Data fetching:** TanStack Query v5, `staleTime: 60_000`. Cursor-based infinite queries for message history.

## Security Notes
- Rate limit WS message events (10/10s per user via Redis sliding window).
- Sanitize message content server-side before storage (`sanitize-html`).
- Never log message content — log userId, conversationId, size only.


