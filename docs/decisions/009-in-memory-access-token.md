# ADR-009: Access token moved from localStorage to an in-memory variable

## Status
Accepted — supersedes the client-storage half of ADR-008 (2026-07-01); ADR-008's
body+Bearer transport decision is unaffected.

## Date
2026-07-01

## Context

ADR-008 put the access token in `localStorage`, explicitly rejecting in-memory
storage because losing the token on reload would force a refresh round-trip
before the first request and race the WS reconnect.

That tradeoff was re-evaluated: `localStorage` is readable by any script running
on the page, so a stored-XSS payload (the primary residual risk noted in ADR-008's
Consequences) can read the access token directly, no timing window required. An
in-memory variable is only reachable by code running in the same JS realm at the
moment of read — closing that off is a meaningful XSS-hardening step even with a
15-minute token lifetime, since `sanitize-html` is defense-in-depth, not a
guarantee.

## Decision

`frontend/src/lib/auth.ts` — `tokenStorage` holds the access token in a
module-scoped `let accessToken` variable instead of `localStorage`. Nothing
persists it across reloads.

```typescript
let accessToken: string | null = null;

export const tokenStorage = {
  getAccess: () => accessToken,
  set: (access) => { accessToken = access; },
  clear: () => { accessToken = null; },
};
```

Consequences of losing the token on reload are absorbed by the reconnect/resync
machinery already needed for other reasons (ADR-011):

- `frontend/src/lib/socket.ts` `connectSocket()` no-ops if there is no token yet
  instead of connecting with `token: null`.
- The 401 interceptor's refresh path (`refreshAccessToken()` in `lib/api.ts`)
  re-acquires a token via the refresh cookie on the first authenticated request
  after a cold load, same as it already did for expiry.

## Alternatives Considered

### Keep localStorage (ADR-008's original choice)

- **Pros:** Survives reload; no extra refresh round-trip on cold load.
- **Cons:** Readable by any script on the page — a single stored-XSS hit reads the
  token with no race condition needed.
- **Rejected:** The reload cost is one refresh call, already paid on every 401;
  the XSS exposure is unconditional as long as the token sits in `localStorage`.

### sessionStorage instead of localStorage

- **Pros:** Scoped to the tab; cleared on tab close.
- **Cons:** Still synchronously readable by any script on the page — same XSS
  exposure as `localStorage`, just a smaller window.
- **Rejected:** Doesn't address the actual threat (XSS script execution, not tab
  persistence).

## Consequences

- **Every full page reload triggers one `/auth/refresh` call** before the first
  authenticated request or WS connection can proceed. Acceptable — the refresh
  cookie makes this transparent to the user, and the same path already runs on
  token expiry.
- **WS connect after reload is deferred** until the refresh completes and calls
  `connectSocket()` — see ADR-011, which was needed regardless to handle
  mid-session disconnects.
- **XSS can no longer read the access token merely by running.** It would need to
  intercept the in-memory value during an active request/response cycle, a
  materially smaller window than an unconditional `localStorage.getItem`.
