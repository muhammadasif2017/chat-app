# Backend

NestJS 11 API for Chat App. See the [root README](../README.md) for full setup, architecture, and environment variable docs.

## Dev commands

```bash
npm run start:dev                          # watch mode on :3001
npm run build                             # compile to dist/
npx tsc --noEmit                          # type-check only
npm test                                  # unit tests
npm run test:cov                          # with coverage
npx prisma migrate dev --name <name>      # create + apply migration
npx prisma generate                       # regenerate client after schema change
npx prisma studio                         # GUI DB browser
```

## Swagger

Available at `http://localhost:3001/api/docs` in development (`NODE_ENV !== production`).
