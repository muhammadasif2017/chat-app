# ADR-002: Prisma runtime adapter instead of datasource URL

## Status
Accepted

## Date
2026-06-12

## Context

Prisma 7 introduced a driver-adapter model that decouples the Prisma Client from
its underlying database driver. This project uses `@prisma/adapter-pg` (the
official PostgreSQL adapter) instead of Prisma's built-in query engine.

The result is a `schema.prisma` that looks wrong to anyone who knows Prisma:

```prisma
datasource db {
  provider = "postgresql"
  # NO url field here — intentional
}
```

Every Prisma tutorial, doc page, and AI assistant will suggest adding
`url = env("DATABASE_URL")`. **Do not add it.** The connection is wired elsewhere.

## Decision

Wire the database connection at runtime in `PrismaService` via `PrismaPg`:

```typescript
// backend/src/prisma/prisma.service.ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
super({ adapter });
```

Migrations and schema management use `prisma.config.ts` (Prisma 7 convention):

```typescript
// backend/prisma.config.ts
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: process.env['DATABASE_URL'] },
});
```

## Alternatives Considered

### Standard datasource URL in schema.prisma

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- **Pros:** Familiar to every Prisma user; matches all tutorials and docs.
- **Cons:** Requires Prisma's bundled Rust query engine binary, which adds ~50 MB
  to the deployment artifact and complicates edge/serverless deployments where
  native binaries are restricted.
- **Rejected:** The adapter model is Prisma 7's preferred path for Node.js
  deployments and is lighter and more flexible.

### Separate connection pooler (PgBouncer / Supavisor)

- **Pros:** Connection pooling at the infrastructure level.
- **Cons:** Adds operational complexity; not needed at current scale.
- **Rejected:** Out of scope; can be layered in later without changing this pattern.

## Consequences

- **`schema.prisma` has no `url` field** — this is correct and intentional.
  Do not add one; it will be ignored and may confuse Prisma CLI tooling.

- **`prisma.config.ts` is required** — the Prisma CLI (`migrate dev`, `generate`,
  `studio`) reads configuration from this file. If it is absent or misconfigured,
  migrations will fail with a cryptic datasource error.

- **After every `prisma migrate dev`, run `prisma generate`** — the adapter model
  requires regenerating the client to pick up schema changes.

- **The Rust query engine is not bundled** — there is no `libquery_engine` binary
  in the project. If you see errors referencing a missing query engine binary, the
  adapter is not being used (check that `PrismaPg` is passed to `super({ adapter })`).
