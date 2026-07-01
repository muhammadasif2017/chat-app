# Frontend

Next.js 16 (App Router) client for Chat App. See the [root README](../README.md) for full setup, architecture, and environment variable docs.

## Dev commands

```bash
npm run dev        # dev server on :3000
npm run build      # production build
npm run lint       # ESLint
npm test           # unit tests
```

## Notes

- Route protection via `proxy.ts` (not `middleware.ts`) — Next.js 16 convention.
- Access token stored in `localStorage` (`ca_access`); refresh token is an HttpOnly cookie managed by the backend.
- Before writing any Next.js code, check `node_modules/next/dist/docs/` — this version has breaking API changes.
