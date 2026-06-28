# ADR 007: Cursor-Based Pagination for Messages

**Date:** 2026-06-28  
**Status:** Accepted

---

## Context

Messages are the most read entity in the app. Users scroll up to load history while new messages arrive at the bottom in real time. We need a pagination strategy that:

1. Loads previous messages (infinite scroll upward)
2. Stays stable while new messages are being inserted concurrently
3. Works efficiently with the existing `Message.id` BigInt sequence

---

## Decision

Use **cursor-based pagination** (keyset pagination) with `Message.id` as the cursor, descending.

The API accepts an optional `cursor` query parameter (a message ID). When provided, the query fetches rows with `id < cursor` in descending order, returning up to `limit` messages. The response includes a `nextCursor` for the next page.

```sql
-- approximate SQL
SELECT * FROM "Message"
WHERE "conversationId" = $1 AND "id" < $cursor
ORDER BY id DESC
LIMIT $limit
```

This leverages the composite index `@@index([conversationId, id(sort: Desc)])` in the schema for O(log n) page fetches regardless of how deep the scroll history goes.

---

## Alternatives Considered

**Offset-based pagination (`OFFSET N LIMIT M`):**
- Simple to implement.
- Breaks when new messages arrive: page 2 shifts if a message is inserted before the user reaches it, causing duplicates or missed messages.
- Performance degrades on large tables: PostgreSQL must scan all `OFFSET` rows before returning results.
- Rejected because both correctness and performance are worse for real-time chat.

**Time-based cursor (`createdAt`):**
- Intuitive, but `createdAt` has second-level precision in Prisma — two messages sent in the same second would produce an ambiguous cursor. `id` (autoincrement BigInt) is strictly monotonic and unique.
- Rejected in favour of `id` cursor.

---

## Consequences

- **Positive:** Stable under concurrent inserts — a new message at the bottom does not affect a user loading older history at the top.
- **Positive:** Index-efficient: page N costs the same as page 1.
- **Positive:** The BigInt autoincrement `id` is already used as the primary key; no extra column is needed for cursoring.
- **Negative:** Random access ("go to page 5") is not possible — requires iterating from the start. Acceptable because chat UIs scroll linearly; no "jump to page N" use case exists.
- **Negative:** The cursor is an internal database ID exposed to the client. It reveals approximate message sequence but no sensitive data.
