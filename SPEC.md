# SPEC: Group Conversations

**Status:** Draft — 2026-06-12  
**Author:** Muhammad Asif  
**Scope:** Full implementation spec (backend + frontend)

---

## 1. Objective

Enable users to create named group conversations with multiple participants, manage membership and roles, and receive real-time updates for all group events (messages, member joins/leaves, role changes, group info edits).

**Target users:**  
- **End users** — create groups, invite friends, manage membership, leave groups.  
- **Developers** — clear API contracts and WS event schema to extend the feature later.

**Success criteria:**
- A user can create a group with a name and ≥1 invited member.
- OWNERs and ADMINs can add/remove members; only OWNERs can promote/demote.
- Any member can leave a group.
- OWNERs and ADMINs can update the group name and description.
- All group membership changes and info edits broadcast in real time to all connected members.
- System messages appear in the conversation timeline for join/leave events.
- The UI works on mobile (responsive, no fixed-width layout assumptions).

**Out of scope (not in this spec):**
- Group avatars / cover images.
- Transferring ownership.
- Public group discovery / join-by-link.
- Push / browser notifications for group events.

---

## 2. Current State

The Prisma schema already supports groups end-to-end:
- `ConversationType` enum has `GROUP`.
- `MemberRole` enum has `OWNER | ADMIN | MEMBER`.
- `Conversation` has `name`, `description`, `isPublic`, `createdById`.
- `ConversationMember` has `role`, `joinedAt`, `isMuted`, `lastReadAt`.
- `MessageType` has `SYSTEM` (for join/leave notices).

**What already works:**
- `POST /conversations` creates a GROUP conversation (creator added as OWNER).
- `POST /conversations/:id/members` / `DELETE /conversations/:id/members/:userId` exist.
- `assertAdminOrOwner` guard exists in `ConversationsService`.
- Sidebar renders GROUP conversations.
- WebSocket room join on connect covers group rooms.

**What is missing:** see §4 and §5 below.

---

## 3. Data Model

No schema migrations required. All necessary fields already exist.

Confirm the `SYSTEM` message type is usable for join/leave notices — it is (`MessageType.SYSTEM` in schema, `metadata` JSON field for structured payloads).

---

## 4. Backend Changes

### 4.1 `POST /conversations` — accept initial member list

**File:** `backend/src/conversations/dto/create-conversation.dto.ts`

Add optional `memberIds: string[]` field (validated as array of UUIDs, max 49 members besides creator).

```
memberIds?: string[]   // user IDs to add as MEMBER on creation
```

**File:** `backend/src/conversations/conversations.service.ts` → `create()`

After creating the conversation, bulk-create `ConversationMember` rows for each `memberIds` entry (role `MEMBER`). Deduplicate and exclude the creator's own ID.

Acceptance: `POST /conversations` with `{ type: "GROUP", name: "Team", memberIds: ["uuid1"] }` → conversation returned with creator as OWNER and invited users as MEMBER.

---

### 4.2 `PATCH /conversations/:id` — update group info

**New endpoint** in `conversations.controller.ts`:

```
PATCH /conversations/:id
Body: { name?: string; description?: string }
Guard: OWNER or ADMIN only
```

**New method** in `conversations.service.ts`:

```typescript
async updateGroup(conversationId: string, requesterId: string, dto: UpdateGroupDto)
```

- Calls `assertAdminOrOwner`.
- `prisma.conversation.update({ where: { id }, data: { name, description } })`.
- Returns updated conversation.
- Emits WS event `group_updated` (see §4.5).

**New DTO:** `backend/src/conversations/dto/update-group.dto.ts`

```typescript
name?:        string  // @IsString @IsOptional @MinLength(1) @MaxLength(100)
description?: string  // @IsString @IsOptional
```

---

### 4.3 `PATCH /conversations/:id/members/:userId/role` — change member role

**New endpoint** in `conversations.controller.ts`:

```
PATCH /conversations/:id/members/:userId/role
Body: { role: "ADMIN" | "MEMBER" }
Guard: OWNER only (not ADMIN)
```

**New method** in `conversations.service.ts`:

```typescript
async updateMemberRole(
  conversationId: string,
  requesterId: string,
  targetUserId: string,
  role: 'ADMIN' | 'MEMBER',
)
```

- Verifies requester is OWNER (extend `assertAdminOrOwner` or add `assertOwner`).
- Cannot change own role.
- `prisma.conversationMember.update({ where: { conversationId_userId }, data: { role } })`.
- Emits WS event `member_role_changed` (see §4.5).

---

### 4.4 `addMember` and `removeMember` — emit WS events + system messages

**File:** `backend/src/conversations/conversations.service.ts`

Current `addMember` and `removeMember` are fire-and-forget (no events). They need to emit WS events and create SYSTEM messages, but the service should not import the gateway (circular dep). 

**Pattern:** return an event descriptor from the service; the gateway calls the service then emits:

```typescript
// addMember returns:
{ member: ConversationMember & { user: User }; systemMessage: Message }

// removeMember returns:
{ userId: string; conversationId: string; systemMessage: Message }
```

The SYSTEM message is created inside the service via `prisma.message.create`:

```typescript
// join
{ conversationId, senderId: targetUserId, type: 'SYSTEM', content: null,
  metadata: { event: 'member_joined', userId: targetUserId } }

// leave / kick
{ conversationId, senderId: requesterId, type: 'SYSTEM', content: null,
  metadata: { event: 'member_left', userId: targetUserId } }
```

**File:** `backend/src/conversations/conversations.controller.ts`

The HTTP endpoints for add/remove will return the result but cannot emit WS events. Move add/remove to be WS-only events (see §4.5), OR keep the HTTP endpoints and emit from the gateway via a shared `EventEmitter2`. 

**Decision: keep HTTP endpoints; use `EventEmitter2`** (already available in NestJS) to decouple:
- Service emits `internal.member.added` / `internal.member.removed` / `internal.member.role_changed` / `internal.group.updated` via `EventEmitter2`.
- Gateway listens with `@OnEvent(...)` and broadcasts to the Socket.io room.

This avoids circular deps and keeps the service pure.

---

### 4.5 WebSocket events (outbound — server → clients)

All events broadcast to the Socket.io room `conversation:<conversationId>`.

| Event | Payload |
|---|---|
| `member_added` | `{ conversationId, member: { userId, role, joinedAt, user: { id, username, avatarUrl } }, systemMessage }` |
| `member_removed` | `{ conversationId, userId, systemMessage }` |
| `member_role_changed` | `{ conversationId, userId, role }` |
| `group_updated` | `{ conversationId, name, description }` |

`systemMessage` payload mirrors the existing `new_message` event shape (id as string, all fields serialized).

---

### 4.6 New files

```
backend/src/conversations/dto/update-group.dto.ts
backend/src/conversations/dto/add-members.dto.ts   (wraps memberIds for create)
```

No new modules needed — all changes are within the existing `ConversationsModule`.

---

## 5. Frontend Changes

### 5.1 API layer — `lib/api.ts` (no changes needed)

All new calls use the existing Axios instance. Add typed helper functions in a new file:

**New file:** `frontend/src/lib/groups.ts`

```typescript
createGroup(name, description, memberIds)  → POST /conversations
updateGroup(id, patch)                     → PATCH /conversations/:id
addMember(conversationId, userId)          → POST /conversations/:id/members
removeMember(conversationId, userId)       → DELETE /conversations/:id/members/:userId
updateMemberRole(conversationId, userId, role) → PATCH /conversations/:id/members/:userId/role
searchUsers(query)                         → GET /users/search?q=...  (see §5.7)
```

---

### 5.2 `CreateGroupModal` — new component

**File:** `frontend/src/components/chat/CreateGroupModal.tsx`

Triggered by a "New Group" button added to the Sidebar Groups section header.

**Fields:**
- Group name (required, 1–100 chars)
- Description (optional)
- Member search input — debounced `GET /users/search?q=` — renders results as a pick list; selected users shown as removable chips

**On submit:** calls `createGroup`, then `router.push('/conversations/<new-id>')`, invalidates `['conversations']` query.

**UI states:** loading (disabled submit), error (inline message).

---

### 5.3 `GroupMembersPanel` — new component

**File:** `frontend/src/components/chat/GroupMembersPanel.tsx`

Slide-in panel (right side, overlays or pushes the message area) listing all members.

**Per member row:**
- Avatar + username + role badge (`OWNER` | `ADMIN` | `MEMBER`)
- If `myRole === 'OWNER'`: dropdown to promote to ADMIN / demote to MEMBER
- If `myRole === 'OWNER' | 'ADMIN'`: "Remove" button (cannot remove OWNER)
- Online indicator via presence data

**Panel footer actions:**
- OWNER/ADMIN: "Add Members" — opens a search-and-select flow (reuses user search from `CreateGroupModal`)
- Any member: "Leave Group" — confirmation prompt → `removeMember(conversationId, currentUserId)`

**Visibility:** toggled by a button in `ConversationHeader` (§5.4), local `useState`.

---

### 5.4 `ConversationHeader` — extend for groups

**File:** `frontend/src/components/chat/ConversationHeader.tsx`

Add a "Members" icon button (visible only when `conversation.type === 'GROUP'`) that toggles `GroupMembersPanel`. Pass `onToggleMembers` and `showMembers` as props from the conversation page.

For GROUP type, show member count as a clickable label that also toggles the panel.

---

### 5.5 `GroupInfoEditor` — inline edit in panel header

**File:** `frontend/src/components/chat/GroupMembersPanel.tsx` (within the same file, not a separate component)

At the top of `GroupMembersPanel`, show group name + description. If `myRole === 'OWNER' | 'ADMIN'`, show edit icon → inline form with name/description inputs → PATCH `/conversations/:id`.

On save: invalidate `['conversation', id]` and `['conversations']` queries.

---

### 5.6 `useChat` hook — handle new WS events

**File:** `frontend/src/hooks/useChat.ts`

Add listeners for:

```typescript
socket.on('member_added', ({ conversationId, member, systemMessage }) => {
  // update ['conversation', conversationId] cache — append member
  // append systemMessage to ['messages', conversationId] infinite query
  // invalidate ['conversations'] to refresh sidebar
})

socket.on('member_removed', ({ conversationId, userId, systemMessage }) => {
  // update ['conversation', conversationId] cache — filter out member
  // append systemMessage
  // if userId === currentUser.id → redirect to '/' (kicked from group)
})

socket.on('member_role_changed', ({ conversationId, userId, role }) => {
  // update member role in ['conversation', conversationId] cache
})

socket.on('group_updated', ({ conversationId, name, description }) => {
  // update ['conversation', conversationId] cache
  // invalidate ['conversations'] sidebar
})
```

---

### 5.7 User search endpoint (backend prerequisite)

**File:** `backend/src/users/users.controller.ts`

Add:
```
GET /users/search?q=<query>
```
Returns `User[]` (id, username, email, avatarUrl) matching username ILIKE `%q%`, limit 20, excluding the requester. No new service method needed — inline Prisma call is fine.

---

### 5.8 Sidebar — "New Group" entry point

**File:** `frontend/src/components/chat/Sidebar.tsx`

Add a `+` icon button next to the "Groups" section header. On click, render `CreateGroupModal` (local state). No layout changes — button sits inline with the section title.

---

## 6. Code Style & Conventions

Match the existing patterns exactly:

- **Backend imports:** `.js` extensions on all relative imports.
- **Backend DTOs:** `class-validator` decorators, no Zod.
- **Backend services:** constructor-injected `PrismaService`, no repository pattern.
- **Frontend types:** extend `frontend/src/types/index.ts` for new shapes (do not create separate type files).
- **Frontend queries:** TanStack Query v5 with `queryKey` arrays; `staleTime: 60_000`.
- **Frontend mutations:** inline `api.*` calls in component handlers (no `useMutation` wrappers unless the component is complex).
- **Frontend components:** `'use client'` only where needed; no default exports in component files.
- **Styling:** Tailwind CSS utility classes; match the existing gray-800 sidebar / indigo-500 accent palette.
- **No new packages** unless unavoidable.

---

## 7. Implementation Order

Each step is independently verifiable before moving to the next.

```
1. GET /users/search endpoint
   → verify: curl returns matching users, excludes self

2. PATCH /conversations/:id (update group info)
   → verify: name/description update persisted, 403 for MEMBER

3. PATCH /conversations/:id/members/:userId/role
   → verify: role change persisted, 403 for non-OWNER

4. Extend POST /conversations to accept memberIds
   → verify: group created with all members in DB

5. Wire EventEmitter2 for member events; ChatGateway listens + broadcasts
   → verify: two browser tabs — add member on one, see member_added on other

6. Frontend: CreateGroupModal + Sidebar "New Group" button
   → verify: group appears in sidebar for all invited users

7. Frontend: GroupMembersPanel (view + leave)
   → verify: member list renders correctly; leave removes user from group

8. Frontend: GroupMembersPanel admin actions (add/remove/role change)
   → verify: actions reflected in real time on all tabs

9. Frontend: inline group info editor in panel
   → verify: name/description update reflects in sidebar and header

10. Frontend: useChat WS event handlers for all group events
    → verify: kicked user redirected; joined user sees group; role change reflected
```

---

## 8. Testing Strategy

**Backend (manual via curl / Postman):**
- Create group with 3 members → confirm all 3 appear in DB.
- Try to update group as MEMBER → expect 403.
- Try to change role as ADMIN → expect 403 (OWNER-only).
- Add member via HTTP → confirm `member_added` WS event fires on other connected clients.
- Remove self → confirm `member_removed` fires and `member_left` SYSTEM message appears.

**Frontend (manual in browser):**
- Open two browser tabs as different users.
- Tab A creates group, invites Tab B's user → Tab B sees group in sidebar without refresh.
- Tab B sends a message → Tab A sees it.
- Tab A (OWNER) removes Tab B → Tab B is redirected to `/`.
- Tab A edits group name → Tab A's header and sidebar update.

**Type safety:** run `npx tsc --noEmit` in both `backend/` and `frontend/` after all changes.

---

## 9. Boundaries

| Category | Rule |
|---|---|
| **Always** | Verify membership server-side on every WS event — never trust client-declared conversationId |
| **Always** | Sanitize group name/description server-side (already wired via `sanitize-html` in messages — apply same to group fields) |
| **Always** | Return 403, not 404, when requester lacks permission but the resource exists |
| **Ask first** | If adding a member would exceed a reasonable limit (e.g., 100 members) — define limit before implementing |
| **Ask first** | Any change to the existing DM (`DIRECT`) creation flow |
| **Never** | Allow a MEMBER to call add/remove/role-change endpoints |
| **Never** | Allow the last OWNER to be removed or demoted (guard against ownerless groups) |
| **Never** | Log message content — log userId, conversationId, event type only |
| **Never** | Add group-specific fields to the shared `Message` type in `frontend/src/types/index.ts` — extend only |
