# Contributing

MythicalHelper is maintained as one public website and one public codebase.

## Before opening a PR

- open an issue first for significant product, copy, or flow changes
- keep changes aligned with the current certificate-first product direction
- avoid reintroducing payments, badges, or legacy membership concepts
- do not commit secrets, local databases, or generated runtime state

## Local development

```bash
npm install
npm run dev:static
npm run dev:worker
npm run db:migrate:local
```

The local frontend runs on `http://localhost:8000`.
The local Worker runs on `http://localhost:8787`.

## Pull request scope

Good PRs are usually one of:

- visual refinements to the four active pages
- copy and content improvements
- Worker or D1 fixes
- authentication and email delivery improvements
- accessibility, mobile layout, and verification flow improvements

## Review expectations

- keep diffs focused
- explain user-facing impact clearly
- include screenshots for layout changes
- mention any Worker, D1, or email behavior changes explicitly

## Security and privacy

- never commit secrets
- never commit `.dev.vars`, local D1 state, or mail credentials
- avoid adding unnecessary personal-data fields
- treat email access and verification flows as sensitive surfaces
