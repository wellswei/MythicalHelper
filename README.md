# MythicalHelper

MythicalHelper is an open-source nonprofit website centered on a printable, verifiable certificate for parents who want to preserve childhood wonder with care.

The core idea is simple: when a child grows old enough to hear that Santa Claus, the Tooth Fairy, or other childhood legends were "just made up," they can discover a certificate and verification page showing that their parents were acting as trusted helpers on behalf of that larger world.

## Why This Exists

MythicalHelper exists to give visible form to a kind of care that usually stays hidden.

Many parents spend years carrying out gifts, traditions, and small works of wonder by hand. This project treats that effort not as a throwaway trick, but as a real act of stewardship. Its goal is to help families keep that effort legible, so that when the right moment comes, a child can understand that wonder was not erased by human hands. It was carried forward through them.

## Product

The project is organized around four pages:

- a public homepage
- an access page
- a certificate page with PDF export
- a public verification page

## Repository

```text
MythicalHelper/
├── access/                # Access flow
├── certificate/           # Certificate page
├── verify/                # Public verification page
├── worker/                # Cloudflare Worker + D1 backend
├── styles/                # Shared site styles
├── index.html             # Homepage
├── package.json           # Local dev scripts
└── logo.png               # Project logo
```

## Active Pages

- [index.html](/Users/wei/GitHub/MythicalHelper/index.html): homepage
- [access/index.html](/Users/wei/GitHub/MythicalHelper/access/index.html): access flow for creating or retrieving a record
- [certificate/index.html](/Users/wei/GitHub/MythicalHelper/certificate/index.html): certificate view with QR generation and PDF export
- [verify/index.html](/Users/wei/GitHub/MythicalHelper/verify/index.html): public verification page
- [worker/src/index.js](/Users/wei/GitHub/MythicalHelper/worker/src/index.js): Cloudflare Worker API
- [worker/migrations/0001_init.sql](/Users/wei/GitHub/MythicalHelper/worker/migrations/0001_init.sql): D1 schema

## Runtime

The active flow has a lightweight backend shape:

- the access page can create, retrieve, edit, and delete a record through `/api`
- the certificate page can read a record through an access token or session
- the verification page can read a public record through a verify token
- the certificate page exports the result as a browser-side PDF

Current auth behavior:

- `Sign Up` creates a record and establishes a session
- `Sign In` sends a magic link
- opening that magic link restores an editable session
- `Access` automatically becomes edit mode while a session is active

## Development

Install dependencies:

```bash
npm install
```

Run the frontend:

```bash
npm run dev:static
```

Run the Worker locally in a second terminal:

```bash
npm run dev:worker
```

Apply the local D1 schema before testing the API:

```bash
npm run db:migrate:local
```

During local development:

- the static frontend runs on `http://localhost:8000`
- the Worker API runs on `http://localhost:8787`
- the frontend will automatically use `http://localhost:8787/api` when opened from a local static server

## Deployment

The project is deployed as:

- Cloudflare Pages for the website
- Cloudflare Workers + D1 for the API
- Zoho for outbound magic-link email

Production domains:

- `https://mythicalhelper.org`
- `https://www.mythicalhelper.org`
- `https://api.mythicalhelper.org`

Before deploying the Worker:

- configure [worker/wrangler.jsonc](/Users/wei/GitHub/MythicalHelper/worker/wrangler.jsonc)
- create and bind the production D1 database
- apply [worker/migrations/0001_init.sql](/Users/wei/GitHub/MythicalHelper/worker/migrations/0001_init.sql)

To enable Zoho sending in the Worker, configure:

- `EMAIL_MODE=zoho`
- `APP_ORIGIN`
- `ZOHO_EMAIL`
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- optional: `ZOHO_ACCOUNT_ID`

## How To Help

The most useful contributions right now are:

- copy and narrative refinements that feel warmer, clearer, and more believable
- mobile layout and accessibility improvements
- authentication, session, and magic-link polish
- Zoho and email delivery reliability improvements
- multilingual support
- new realm ideas that still fit mainstream childhood folklore and family ritual

If you want to contribute, start small and stay close to the current certificate-first product shape.

## Open Source

- [LICENSE](/Users/wei/GitHub/MythicalHelper/LICENSE)
- [CONTRIBUTING.md](/Users/wei/GitHub/MythicalHelper/CONTRIBUTING.md)
- [SECURITY.md](/Users/wei/GitHub/MythicalHelper/SECURITY.md)
- [CODE_OF_CONDUCT.md](/Users/wei/GitHub/MythicalHelper/CODE_OF_CONDUCT.md)

## License

MIT License.
