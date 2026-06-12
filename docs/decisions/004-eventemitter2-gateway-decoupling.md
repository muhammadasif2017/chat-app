# ADR-004: EventEmitter2 for service-to-gateway communication

## Status
Accepted

## Date
2026-06-12

## Context

Several HTTP endpoints need to trigger WebSocket broadcasts after completing a
database operation. For example, `POST /conversations/:id/members` (handled by
`ConversationsController` → `ConversationsService`) must broadcast `member_added`
to everyone in the conversation room.

The natural implementation would be to inject `ChatGateway` into
`ConversationsService` and call `this.gateway.server.to(...).emit(...)` directly.
This is impossible: `ChatGateway` already injects `ConversationsService`, creating
a circular dependency that NestJS cannot resolve at startup.

## Decision

Services emit named internal events via `EventEmitter2`; `ChatGateway` listens
with `@OnEvent()` decorators:

```typescript
// ConversationsService — emit after DB write
this.events.emit('internal.member.added', { conversationId, member, systemMessage });

// ChatGateway — react and broadcast to Socket.io room
@OnEvent('internal.member.added')
handleMemberAdded(payload: { ... }) {
  this.server.to(`conversation:${payload.conversationId}`).emit('member_added', ...);
}
```

Internal event names are prefixed with `internal.` to distinguish them from
Socket.io client events.

## Alternatives Considered

### Inject ChatGateway into ConversationsService

- **Pros:** Direct call, no indirection.
- **Cons:** Circular dependency — NestJS resolves DI at module load time and will
  throw `Error: Nest cannot create the module instance`.
- **Rejected:** Not possible without `forwardRef()` hacks.

### `forwardRef()` circular injection

- **Pros:** Works around the circular dependency.
- **Cons:** `forwardRef()` is a code smell in NestJS; it makes module loading
  order fragile and harder to test. NestJS docs discourage it for anything except
  truly unavoidable cases.
- **Rejected:** EventEmitter2 is cleaner and already in the dependency tree
  (included via `EventEmitterModule.forRoot()` in `AppModule`).

### Move broadcast logic into the controller

- **Pros:** No circular dependency; controller can import both service and gateway.
- **Cons:** Controllers should be thin routing layers, not business logic hosts.
  The broadcast is part of the operation's side effect, not an HTTP concern.
- **Rejected:** Violates the separation between HTTP transport and application logic.

### WebSocket-only endpoints (no HTTP for member management)

- **Pros:** Eliminates the problem entirely — all mutations go through the gateway.
- **Cons:** HTTP endpoints are needed for non-WebSocket clients and for idiomatic
  REST semantics (testable with curl, standard tooling, cacheable).
- **Rejected:** Removing HTTP endpoints would reduce API usability.

## Consequences

- **`EventEmitterModule.forRoot()` must remain in `AppModule`** — removing it
  silences all `internal.*` events without any compile-time error.

- **Event payloads are untyped at the boundary** — `@OnEvent()` handlers receive
  `unknown` unless manually typed. Keep the payload type declarations in both the
  emit call and the handler in sync; they are not enforced by the compiler.

- **Internal events are fire-and-forget** — `EventEmitter2` does not guarantee
  delivery if the listener throws. Errors in `@OnEvent()` handlers are caught by
  NestJS and logged, but they do not roll back the DB transaction that preceded
  the emit. Design handlers to be safe to retry or idempotent where possible.

- **Test isolation** — unit tests for `ConversationsService` mock `EventEmitter2`
  and assert on `events.emit` calls. Gateway behavior is tested separately (or in
  integration tests) by asserting on the Socket.io server mock.
