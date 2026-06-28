# ADR-001: Conversation-level read tracking for read receipts

## Status
Accepted

## Date
2026-06-12

## Context

Phase 13 adds "Seen by" avatars below messages. The schema already contains two
mechanisms for tracking who has read what:

1. **`ConversationMember.lastReadAt`** — a single `DateTime?` per user per
   conversation, updated whenever the user opens the conversation or receives a
   new message while viewing it.

2. **`MessageRead`** — a join table with one row per `(messageId, userId)` pair,
   intended for per-message granularity. It was scaffolded as part of the initial
   schema but nothing ever writes to it.

We needed to decide which mechanism to build on.

## Decision

Use `ConversationMember.lastReadAt`. The `MessageRead` table is intentionally left
unwritten.

A member is considered to have "seen" a message if:

```
member.lastReadAt >= message.createdAt
```

This comparison is done client-side using ISO 8601 string comparison (both fields
are UTC timestamps serialized as strings; ISO 8601 is lexicographically monotonic).

## Alternatives Considered

### Per-message tracking via `MessageRead`

- **Pros:** Exact per-message granularity; survives clock skew between a user
  opening a conversation and a message arriving at the same millisecond.
- **Cons:**
  - Every `mark_read` action would write O(unread messages) rows instead of
    updating one column. In a group with 50 unread messages this is 50× more
    DB writes per read event.
  - The table grows without bound unless pruned. Pruning logic adds operational
    complexity.
  - The extra granularity is invisible to users — the UX (avatars below messages)
    looks identical either way, because what matters is "did this person read
    past this message", which `lastReadAt` answers correctly.
- **Rejected:** write amplification not justified by any UX gain.

### Hybrid: write `MessageRead` only for the most recent N messages

- **Pros:** Limits write amplification.
- **Cons:** Adds conditional logic for "is this message in the window?"; still
  more complex than the `lastReadAt` approach.
- **Rejected:** not simpler than pure `lastReadAt`; gains nothing over it.

## Consequences

- **`MessageRead` table is intentionally unused.** If per-message granularity is
  ever needed (e.g., message-level analytics, partial-read tracking for long
  threads), the table is already in the schema and can be populated incrementally
  without a migration. Don't remove it and don't let a future linter flag it as
  dead code — it is a reserved extension point.

- **Clock skew is a known limitation.** If `lastReadAt` is generated slightly
  before a message's `createdAt` on the same server (same clock, so this is
  sub-millisecond), a message could briefly appear unread to a user who has
  actually read it. In practice this is invisible at human timescales. A
  message-ID cursor would be strictly correct but requires schema changes.

- **`markRead` returns the persisted `Date`** so the gateway can broadcast the
  exact timestamp written to the DB (`message_read` WS event includes
  `lastReadAt`). This prevents client-server drift from a second `new Date()`
  call at broadcast time.

- **Only the current user's own `message_read` events trigger a
  `GET /conversations` refetch.** Other members' read events update the
  in-memory receipt avatars only (cheap `setQueryData`). This avoids O(members)
  redundant conversation-list refetches per read event in a group.
