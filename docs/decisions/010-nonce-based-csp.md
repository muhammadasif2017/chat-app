# ADR-010: Nonce-based CSP, set per-request in proxy.ts instead of statically in next.config.ts

## Status
Accepted

## Date
2026-07-02

## Context

The static CSP in `next.config.ts` (`script-src 'self'`) blocked Next.js 16's
inline RSC hydration scripts — they're emitted inline per-request and have no
way to satisfy a bare `'self'` script-src without `'unsafe-inline'`, which
defeats the point of a script-src restriction (any injected inline script would
also be allowed).

A CSP header is static config in `next.config.ts` — it can't embed a per-request
value. A nonce, by definition, must be freshly generated per request and matched
against the `nonce="..."` attribute Next attaches to its inline scripts, so it
can only be computed where per-request state exists: `proxy.ts` (the request
middleware), not the build-time Next config.

## Decision

Move CSP construction from `next.config.ts` into `proxy.ts`, generated fresh on
every request:

```typescript
const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
const csp = buildCsp(nonce); // script-src 'self' 'nonce-{nonce}' 'strict-dynamic'
```

- The nonce is written to an `x-nonce` request header so Next can read it
  server-side and stamp it onto its hydration `<script>` tags.
- The CSP header itself is set on every response path in `proxy.ts` — the login
  redirect, the authed redirect, and the pass-through — so no response leaves
  without it.
- `'strict-dynamic'` lets nonce-approved scripts load further scripts (Next's
  chunking) without listing every chunk URL individually.
- Dev builds add `'unsafe-eval'` to `script-src` (Next dev/HMR needs `eval`);
  production does not.
- `next.config.ts` no longer sets `Content-Security-Policy` — only the
  nonce-independent headers (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`) stay there, since those don't vary per request.

## Alternatives Considered

### `'unsafe-inline'` for script-src

- **Pros:** No per-request nonce plumbing; works in static config.
- **Cons:** Allows any inline script, including one injected via XSS — removes
  the protection a script-src is meant to provide.
- **Rejected:** Defeats the purpose of restricting script-src at all.

### Hash-based CSP (`'sha256-...'` per script)

- **Pros:** No per-request generation; static like the original config.
- **Cons:** Next's RSC hydration payload differs per request (embeds page data),
  so its hash isn't stable across requests — would require hashing at request
  time anyway, same cost as a nonce with more fragility.
- **Rejected:** No advantage over a nonce given the hydration payload isn't static.

## Consequences

- CSP is now request-scoped logic living in `proxy.ts` alongside the existing
  auth-redirect logic, not a static file-level constant — anyone changing the
  policy edits `buildCsp()` there, not `next.config.ts`.
- Every response path in `proxy.ts` must remember to set the header; a new
  redirect branch added later that forgets it silently ships without CSP.
- Dev and prod now diverge (`'unsafe-eval'` only in dev) — a CSP violation seen
  only in production (never locally) may be this difference.
