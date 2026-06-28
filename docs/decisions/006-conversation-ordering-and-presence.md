# ADR 006: Conversation Ordering and Last-Seen Presence

**Date:** 2026-06-28  
**Status:** Accepted

---

## Context

Two related UX requirements needed design decisions:

1. **Conversation ordering** — the sidebar should list conversations with the most recently active conversation at the top, and this order should update in real time when new messages arrive.

2. **Last-seen timestamps** — when a DM contact is offline, the conversation header should show when they were last active ("Last seen 3h ago").

---

## Decision

### Conversation ordering

The `Conversation` model has an `updatedAt` field. The `findAll` query sorts by `conversation.updatedAt DESC`.

When a message is created via `MessagesService.create`, we immediately issue a second `prisma.conversation.update({ data: { updatedAt: new Date() } })` on the same conversation. This keeps `updatedAt` in sync with last-message activity.

On the frontend, the `useChat` hook calls `qc.invalidateQueries({ queryKey: ['conversations'] })` on every `new_message` WebSocket event. This triggers a background refetch of the sidebar list, which re-reads the server-ordered result. The user sees the updated order with the active conversation bubbled to the top.

### Last-seen timestamps

The `PresenceService.setOffline` method updates `user.lastSeenAt = new Date()` whenever a socket disconnects (user closes browser or loses connection). This timestamp is persisted in PostgreSQL.

The `MEMBER_SELECT` projection on the conversation endpoints includes `lastSeenAt`, so it arrives in the same API response as the rest of the conversation data — no separate API call needed.

In the `ConversationHeader` component, the `usePresence` hook provides the live online/offline state. On WS connect, the gateway emits `presence_roster` — a map of `{ [userId]: boolean }` covering all members across the user's conversations — which seeds `usePresence`'s initial state. Subsequent `user_online` / `user_offline` events update it incrementally. If the other user is online, the subtitle shows "Online". If offline, it formats the stored `lastSeenAt` as a human-readable relative time ("Last seen 3h ago") using the `formatRelativeTime` utility.

---

## Alternatives Considered

### Ordering: maintain a separate `lastMessageAt` column

A dedicated `lastMessageAt` on `Conversation` would be semantically clearer. Rejected because `updatedAt` serves the same purpose with zero schema migration cost and no extra column to maintain.

### Ordering: sort client-side after cache update

Sort the conversations array in the TanStack Query cache updater rather than re-fetching from the server. Rejected because the server is the source of truth for ordering, and client-side sorting would diverge if the list is open across multiple tabs.

### Last-seen: poll `/users/:id` for presence state

Fetch last-seen from a dedicated user endpoint. Rejected because the data is already available in the conversation member payload — an extra round trip adds latency for zero benefit.

---

## Consequences

- Every message send issues an extra `UPDATE` on the `Conversation` table. At chat-app scale this is negligible.
- The `invalidateQueries` approach means the sidebar makes a round-trip on every received message. A future optimization could update the cache directly using `setQueryData` to avoid the network request, but the current approach keeps cache consistency simple.
- `lastSeenAt` is only accurate when a user disconnects cleanly (socket close event fires). If the connection drops without a clean disconnect event, `setOffline` may not run immediately — Socket.io's disconnect timeout handles this within a few seconds.
