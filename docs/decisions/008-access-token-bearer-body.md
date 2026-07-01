# ADR-008: Access token in response body + Bearer auth (reverses cookie storage)

## Status
Accepted — supersedes the access-token half of ADR-003's cookie migration (2026-06-28)

## Date
2026-07-01

## Context

ADR-003 (updated 2026-06-28) moved **both** JWTs into `HttpOnly` cookies to keep
them out of reach of XSS. That protected the tokens from JavaScript exfiltration,
but broke or complicated two things:

- **WebSocket handshake.** Socket.io's handshake reads its credential from
  `handshake.auth.token`, which the client must set in JS. An `HttpOnly` cookie
  is by definition unreadable by JS, so the browser could not hand the access
  token to `io({ auth: { token } })`. The cookie-only setup forced
  `withCredentials: true` on the socket and cookie parsing in `handleConnection`,
  coupling WS auth to same-site cookie delivery.

- **CSRF surface.** A cookie-borne access token is sent automatically on every
  request to the API origin, so every state-changing endpoint needs CSRF
  protection beyond `SameSite=Lax`. A `Bearer` token is only sent when the client
  explicitly attaches it, so it is not forgeable via cross-site requests.

The persistent credential is the **refresh** token, not the access token. If the
durable credential stays `HttpOnly`, exposing the short-lived (15 min) access
token to JS is a bounded risk.

## Decision

Split the two tokens by transport:

| Token | Lifetime | Transport | Client storage |
|---|---|---|---|
| Access | 15 min | Returned in login/register/refresh **response body** | `localStorage` (`ca_access`), sent as `Authorization: Bearer` |
| Refresh | 7 days | `HttpOnly; SameSite=Lax; Secure` cookie, path `/auth/refresh` | none (browser-managed) |

Concretely:

- **Backend** — `JwtStrategy` reads the access token via
  `ExtractJwt.fromAuthHeaderAsBearerToken()` instead of a cookie extractor.
  Swagger switches from `addCookieAuth('access_token')` to `addBearerAuth()` +
  `addCookieAuth('refresh_token')`. The refresh cookie is unchanged.

- **Frontend** — `lib/auth.ts` `tokenStorage` keeps the access token in
  `localStorage`. `lib/api.ts` request interceptor attaches
  `Authorization: Bearer <token>`; the 401 interceptor stores the new access
  token from the refresh response and retries. `lib/socket.ts` passes the token
  via `auth: { token }`, refreshed on each `connectSocket()`.

## Alternatives Considered

### Keep both tokens in HttpOnly cookies (ADR-003, 2026-06-28)

- **Pros:** Access token unreadable by JS — immune to XSS token theft.
- **Cons:** WS handshake cannot read the token to pass into `auth.token`; every
  API mutation carries CSRF risk from the auto-sent cookie.
- **Rejected:** The WS coupling and CSRF surface outweigh XSS protection on a
  token that already expires in 15 minutes.

### Access token in `localStorage`, refresh token also in `localStorage`

- **Pros:** Uniform storage; no cookie/CORS config.
- **Cons:** Exposes the **durable** 7-day credential to XSS. A single XSS then
  yields persistent access.
- **Rejected:** The refresh token is the credential worth protecting; it stays
  `HttpOnly`.

### Access token in memory only (no localStorage)

- **Pros:** Nothing persisted for XSS to read across reloads.
- **Cons:** Lost on every page reload → a silent refresh round-trip on each load
  before any request can be made; WS reconnect races the refresh.
- **Rejected:** Adds a refresh dependency to cold loads for marginal gain over a
  15-minute token; can revisit if XSS hardening demands it.

## Consequences

- **XSS can read the access token.** Mitigated by the 15-minute lifetime and by
  keeping the refresh token `HttpOnly`. Server-side `sanitize-html` on message
  content (see Security Notes) remains the primary XSS defense; a stored-XSS
  regression would now also leak a short-lived access token.

- **No CSRF protection needed for API mutations** — the access token is not
  auto-sent. The only cookie is the refresh token, scoped to `path=/auth/refresh`.

- **WS auth is transport-agnostic** — `handshake.auth.token` works the same for
  browser and future mobile/native clients, which never had cookies.

- **ADR-003 is now split by token:** its refresh-token cookie decision still
  holds; its access-token cookie decision is superseded here.
