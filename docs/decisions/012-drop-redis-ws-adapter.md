# ADR-012: Drop the Redis Socket.io adapter, run single-instance

## Status
Accepted

## Date
2026-07-03

## Context

`ChatGateway` used a `RedisIoAdapter` (`@socket.io/redis-adapter` + `redis`
npm client) so that Socket.io events would fan out across multiple backend
instances behind a load balancer — a client connected to instance A would
still receive an event emitted by a handler running on instance B.

The app runs as a single backend instance in every environment it's actually
deployed to (dev, and the current production target). The adapter added a
second Redis client, two extra dependencies, and a class
(`redis-io.adapter.ts`) whose only job was to solve a problem — multi-instance
fanout — that doesn't exist yet. No traffic or latency evidence suggested
horizontal scaling was imminent.

## Decision

Replace `RedisIoAdapter` with a plain `SocketIoAdapter`
(`backend/src/infra/websocket/socket-io.adapter.ts`) — the default `IoAdapter`,
overriding only `createIOServer` to set CORS from `ConfigService`. `main.ts`
was updated to use it; `@socket.io/redis-adapter` and `redis` were dropped
from `backend/package.json`.

`ioredis` / `RedisModule` / `REDIS_CLIENT` were **not** touched — they still
back `PresenceService` (online/offline, typing TTL keys) and
`ChatGateway.checkRateLimit` (see ADR-005). This change only removes the
Socket.io transport's cross-instance pub/sub; Redis-backed presence and rate
limiting are unaffected and still work identically on a single instance.

## Alternatives Considered

### Keep the Redis adapter for future-proofing

- **Pros:** Multi-instance scaling would need no gateway change later.
- **Cons:** Pays a real cost now (extra Redis client, two dependencies, a
  class to maintain and test) for a scenario with no evidence it's coming.
  Violates the project's simplicity-first bias — don't build for hypothetical
  future requirements.
- **Rejected:** Nothing about current load justifies more than one instance.

### Drop Redis entirely (presence + rate limiting too)

- **Pros:** Fewer moving parts still further — an in-memory `Map` with a
  manual TTL sweep would work at single-instance scale, and the existing HTTP
  throttler already does in-memory rate limiting.
- **Cons:** Larger change than the adapter alone; presence and rate-limit
  state would need to survive process restarts differently, and the migration
  wasn't scoped or agreed.
- **Rejected for now:** Out of scope for this change. If revisited, this
  analysis is the starting point — don't re-derive it from scratch.

## Consequences

- **Single point of failure / no horizontal scaling** for WebSocket
  connections — restarting the one backend instance drops every open socket
  (clients reconnect via existing logic, see ADR-011). Acceptable at current
  scale.
- **Adding a second instance later requires reintroducing a cross-instance
  adapter** (Redis pub/sub or equivalent) — this ADR documents the removed
  pattern as the known path back if that becomes necessary.
- **ADR-005's Redis-backed rate limiting is unaffected** — `checkRateLimit`
  uses the same `ioredis` client, untouched by this change. Its
  "shared across instances" framing (ADR-005 Consequences) is now moot for
  WebSocket traffic specifically, since only one instance runs sockets at all.
- Two dependencies (`@socket.io/redis-adapter`, `redis`) and one file
  (`redis-io.adapter.ts`) removed; `npx tsc --noEmit` clean after the change.
