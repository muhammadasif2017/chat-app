# ADR 005: WebSocket Security and Rate Limiting

**Date:** 2026-06-27  
**Status:** Accepted

---

## Context

The chat gateway (`/chat` namespace) exposes real-time events that modify data (send message, edit, delete, mark read) and query data (join_conversation). Without defense-in-depth controls, an authenticated user could:

1. Flood the server with high-frequency WS events, causing DB query exhaustion (DoS via connection reuse — cheaper than HTTP because TLS handshake is amortized).
2. Join arbitrary conversation rooms by passing a fabricated `conversationId`, breaking tenant isolation.
3. Send unbounded `typing_start` events faster than any human could type, burning Redis and CPU.

---

## Decision

### 1. JWT authentication on every connection

The gateway's `handleConnection` hook extracts `socket.handshake.auth.token`, verifies it with `JwtService.verifyAsync`, and attaches `{ id, email }` to `socket.data.user`. Any connection that fails verification is immediately disconnected — unauthenticated sockets never reach an event handler.

### 2. Room membership verified server-side on every event

Every handler that touches conversation data calls `assertMember(conversationId, userId)`, which queries `ConversationMember` before proceeding. The client's declared conversation ID is never trusted. This prevents an authenticated user in conversation A from emitting events targeting conversation B.

### 3. Per-user, per-event-type sliding window rate limiting via Redis

A single shared limit would allow a spam burst on typing events to block message sends. Instead, each event class has its own Redis key namespace and quota:

| Event(s) | Namespace prefix | Limit |
|---|---|---|
| `send_message`, `edit_message`, `delete_message`, `mark_read`, `join_conversation` | `ws_rl` | 10 / 10 s |
| `typing_start`, `typing_stop` | `ws_rl_typing` | 30 / 10 s |
| `ping` | `ws_rl_ping` | 6 / 10 s |

The window key is `{prefix}:{userId}:{floor(epoch_ms / 10000)}`. `INCR` + `EXPIRE 15` is atomic enough for this use case (a second `EXPIRE` call is harmless if the key already has a TTL).

Exceeding the limit raises `WsException('Rate limit exceeded')`, which Socket.io surfaces as an error callback to the emitting client.

### 4. Input validation via class-validator DTOs

Every WS event body is deserialized into a DTO decorated with `class-validator` constraints and validated through `WsValidationPipe`. This prevents type coercion attacks (e.g., sending a string where a number is expected to trigger a BigInt conversion error).

---

## Alternatives Considered

**Single global rate limit per user** — Simpler, but typing events (which fire on every keystroke) would eat into the budget for message sends within the same window. Per-event-type buckets give independent headroom.

**HTTP-layer throttling (`@nestjs/throttler`)** — The existing HTTP throttler is insufficient for WS events because Socket.io frames bypass the HTTP middleware stack after the initial handshake upgrade.

**No rate limiting** — Acceptable during development; unacceptable for a production deployment where a single authenticated socket could sustain thousands of DB queries per second.

---

## Consequences

- **Positive:** Each event type has independent headroom; typing-heavy users are not penalized on message sends.
- **Positive:** Room isolation is enforced in one place (`assertMember`) rather than repeated per-event.
- **Negative:** Two Redis round-trips added to every WS event (INCR for rate limit + the main query). At the expected load, this is acceptable; at very high scale, consider Lua scripting to batch both into one round-trip.
- **Negative:** Rate limits are per-instance until Redis propagates counts — acceptable because the Redis INCR is shared across instances via the same Redis cluster.
