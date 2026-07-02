# ADR-011: WebSocket reconnect resync + delivery-failure toasts

## Status
Accepted

## Date
2026-07-03

## Context

Three gaps existed once the access token became short-lived and (per ADR-009)
non-persistent:

1. **The gateway hard-disconnects on an expired/missing token**, on connect and
   on every subsequent event (see ADR-005). That disconnect reason is
   `io server disconnect`, which socket.io's client treats as intentional and
   does **not** auto-reconnect for. Without intervention, a client whose access
   token expired mid-session goes permanently silent.

2. **Events missed while offline are gone.** Socket.io has no event replay —
   reactions, new messages, membership changes that occurred during a disconnect
   (tab backgrounded, network blip, laptop sleep) never arrive after reconnect.
   The client's cache silently drifts from server state with no signal to the
   user.

3. **Fire-and-forget WS emits have no delivery guarantee.** A message send that's
   dropped in flight (as opposed to explicitly rejected) previously failed
   silently — no ack, no error event, no user-visible signal.

## Decision

**Manual reconnect on server-initiated disconnect** (`useSocket.ts`) — on
`disconnect` with reason `io server disconnect`, call `refreshAccessToken()`
directly (extracted from the 401 interceptor into a shared exported function in
`lib/api.ts`) rather than waiting on socket.io's auto-reconnect, which doesn't
fire for this reason. `connectSocket()` is called again once the new token is
set.

**Resync via query invalidation on any real reconnect** — a `wasDisconnected`
ref tracks whether a `disconnect` happened; the next `connect` event, if it
follows a real disconnect, invalidates the `conversations` and `messages`
TanStack Query caches, forcing a refetch of current server state instead of
trying to reconstruct which individual events were missed.

**Toast surface for two distinct failure classes** (`toast.store.ts` +
`Toast.tsx`, new):
- `error` events from the gateway's `WsExceptionFilter` (rate limit, not a
  member, validation) — previously failed silently client-side.
- `connect_error` during the reconnection backoff loop — shown once per outage
  (`connectErrorShown` ref), not once per retry, since socket.io retries
  frequently during backoff.

**Per-emit delivery acks** — new `emitReliable()` in `lib/socket.ts` wraps
`socket.timeout(8000).emit(event, payload, callback)`. If the ack times out
*and* no `error` event already fired for the same action (checked via
`toast.store`'s `lastShownAt` timestamp against the emit's send time), show a
generic "may not have gone through" toast. The timestamp check exists because
the gateway's rejection path (`WsExceptionFilter`) emits `error` instead of
acking — without it, a rejected action would show two toasts (the specific
`error` message, then a redundant timeout toast).

**Shared refresh path** — `refreshAccessToken()` was pulled out of the 401
interceptor's inline logic so both the HTTP-401 path and the WS
server-disconnect path go through the same `isRefreshing` gate, preventing two
concurrent refresh requests from racing when both an API call and the socket
get kicked for the same expired token.

## Alternatives Considered

### Rely on socket.io's built-in auto-reconnect

- **Pros:** No manual reconnect logic needed.
- **Cons:** Doesn't fire for `io server disconnect` — the exact reason the
  gateway uses for auth failures. A client kicked for an expired token would
  never reconnect on its own.
- **Rejected:** Doesn't cover the actual disconnect path this app produces.

### Event-sourced resync (replay missed events from a server-side log)

- **Pros:** Precise — only re-delivers what was actually missed, cheaper than a
  full refetch.
- **Cons:** Requires a server-side event log keyed per-connection with
  since-cursor semantics; substantial new backend surface for a case (brief
  disconnects) that's already cheap to resolve with a refetch.
- **Rejected:** Full query invalidation is simpler and the conversations/messages
  lists are already paginated and cheap to refetch; not worth the backend
  complexity at current scale.

### Silent delivery failures (no ack, no toast)

- **Pros:** No new UI surface.
- **Cons:** A message the user believes sent but that was dropped in flight is a
  silent data-loss UX bug — user has no way to know to retry.
- **Rejected:** Cheap to add (`socket.timeout().emit()` is built into socket.io
  client) relative to the UX cost of a silently lost message.

## Consequences

- **Query invalidation on reconnect is coarse** — any reconnect after a real
  disconnect refetches conversations and messages regardless of how long the
  gap was (one second or ten minutes). Acceptable at current scale; would need
  the event-sourced alternative above if refetch cost becomes an issue.
- **`onConnectError` toasts show only once per outage**, not per retry — a very
  long outage doesn't re-remind the user it's still down. Deliberate, to avoid
  toast spam during backoff.
- **`emitReliable` requires callers to opt in** — plain `socket.emit()` calls
  elsewhere still have no delivery guarantee. Anything added to
  `MessageInput.tsx`-style send paths later should use `emitReliable`, or the
  new gap reappears silently for that call site.
- **New test surface**: `useSocket.test.ts`, `socket.test.ts`,
  `toast.store.test.ts`, `api.refresh.test.ts` cover the reconnect/resync/toast
  paths — see those specs for exact event-ordering assumptions.
