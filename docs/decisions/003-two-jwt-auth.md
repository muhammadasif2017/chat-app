# ADR-003: Two-JWT authentication with stored, hashed refresh tokens

## Status
Accepted

## Date
2026-06-12

## Context

The app needs authenticated sessions that:
- Stay alive across browser restarts (not just for the tab lifetime)
- Allow a user to log out and immediately invalidate their session
- Limit blast radius if an access token is intercepted

A single long-lived JWT satisfies the first requirement but fails the other two:
you cannot revoke a JWT without a server-side denylist, and a leaked long-lived
token gives an attacker persistent access.

## Decision

Issue two tokens on every login/register/refresh:

| Token | Secret | Lifetime | Stored |
|---|---|---|---|
| Access token | `JWT_SECRET` | 15 min | Client (localStorage) |
| Refresh token | `JWT_REFRESH_SECRET` | 7 days | Client (localStorage) + hashed in DB |

**Access token** — short-lived, verified statelessly on every API request via
`JwtAuthGuard`. If intercepted, it expires in at most 15 minutes.

**Refresh token** — long-lived, but verified against a DB record before issuing
a new pair. The raw token is never stored; only a bcrypt hash is persisted.

```typescript
// On every refresh:
await bcrypt.compare(rawRefreshToken, stored.tokenHash);  // verify
await prisma.refreshToken.delete({ where: { id: jti } }); // rotate (consume)
return this.issueTokens(userId, email);                   // issue new pair
```

**`jti` (JWT ID)** — a `randomUUID()` embedded in the refresh token payload and
used as the DB primary key. It binds the JWT to its DB record without storing the
raw token.

## Alternatives Considered

### Single long-lived JWT (no refresh token)

- **Pros:** Simple; no DB interaction on most requests.
- **Cons:** Cannot revoke sessions; a leaked token is valid until expiry.
- **Rejected:** Logout would be a no-op; unacceptable for a real application.

### Single long-lived JWT + server-side denylist (Redis)

- **Pros:** Revocable without a refresh dance.
- **Cons:** Every request hits Redis to check the denylist, even for non-revoked
  tokens — equivalent complexity to the refresh approach but worse cache behavior.
- **Rejected:** More Redis traffic per request with no UX benefit.

### Storing the raw refresh token in the DB

- **Pros:** Simpler — no bcrypt on refresh.
- **Cons:** A DB breach exposes all live sessions directly. bcrypt means an
  attacker needs to brute-force each token hash individually.
- **Rejected:** bcrypt cost (10 rounds) on refresh is negligible (~100ms), and
  the security gain is material.

### HttpOnly cookie for refresh token

- **Pros:** Not readable by JavaScript; protected against XSS exfiltration.
- **Cons:** Requires `SameSite` and CORS cookie configuration; complicates
  mobile clients; the frontend already uses localStorage for the access token,
  so XSS would still expose sessions.
- **Rejected:** Deferred — can be layered on later if XSS risk becomes a
  priority concern.

## Consequences

- **Logout revokes all sessions** — `logout()` calls
  `refreshToken.deleteMany({ where: { userId } })`, invalidating every device.

- **Refresh token rotation** — each refresh consumes the current token and issues
  a new pair. Using a refresh token twice (e.g., replaying a stolen token) returns
  403, because the first use deleted the DB record.

- **`RefreshToken` table grows** — tokens are deleted on use and on logout, but
  expired-but-unused tokens accumulate. A periodic cleanup job (cron or DB TTL)
  should prune rows where `expiresAt < now`. Not yet implemented.

- **Global `JwtAuthGuard`** is applied at the app level; routes that should be
  public (login, register, refresh) must opt out with the `@Public()` decorator.
  Forgetting `@Public()` on a new public endpoint returns 401.
