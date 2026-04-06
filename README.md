# MythicalHelper

MythicalHelper is an open-source nonprofit website centered on a printable, verifiable certificate for parents who want to preserve childhood wonder with care.

The core idea is simple: when a child grows old enough to hear that Santa Claus, the Tooth Fairy, or other childhood legends were "just made up," they can discover a certificate and verification page showing that their parents were acting as trusted helpers on behalf of that larger world.

## Product

The active project is now organized around four pages:

- a public homepage
- an access page
- a certificate page with PDF export
- a public verification page

## Active Repository

```text
MythicalHelper/
├── access/                # Access flow
├── certificate/           # Certificate page
├── verify/                # Public verification page
├── worker/                # Cloudflare Worker + D1 backend
├── styles/                # Shared site styles
├── backup/                # Legacy code moved out of the active structure
├── index.html             # Homepage
└── logo.png               # Project logo
```

## Active Pages

- [index.html](/Users/wei/GitHub/MythicalHelper/index.html): homepage
- [access/index.html](/Users/wei/GitHub/MythicalHelper/access/index.html): access flow for creating or retrieving a record
- [certificate/index.html](/Users/wei/GitHub/MythicalHelper/certificate/index.html): certificate view with QR generation and PDF export
- [verify/index.html](/Users/wei/GitHub/MythicalHelper/verify/index.html): public verification page
- [worker/src/index.js](/Users/wei/GitHub/MythicalHelper/worker/src/index.js): Cloudflare Worker API
- [worker/migrations/0001_init.sql](/Users/wei/GitHub/MythicalHelper/worker/migrations/0001_init.sql): D1 schema

## Certificate Implementation

The active certificate experience lives in:

- [certificate/index.html](/Users/wei/GitHub/MythicalHelper/certificate/index.html)
- [certificate/index.js](/Users/wei/GitHub/MythicalHelper/certificate/index.js)
- [styles/site.css](/Users/wei/GitHub/MythicalHelper/styles/site.css)

The active flow now has a lightweight backend shape:

- the access page can create or retrieve a record through `/api`
- the certificate page can read a record through an access token
- the verification page can read a public record through a verify token
- `localStorage` remains as a fallback for the current browser prototype
- the certificate page still exports the result as a PDF in the browser

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

The backend skeleton is prepared for Cloudflare Workers + D1:

- configure [worker/wrangler.jsonc](/Users/wei/GitHub/MythicalHelper/worker/wrangler.jsonc)
- apply [worker/migrations/0001_init.sql](/Users/wei/GitHub/MythicalHelper/worker/migrations/0001_init.sql)
- run the Worker alongside the static frontend

Current auth behavior:

- `Sign Up` creates a record and establishes a session
- `Sign In` creates a magic link
- in local development, that link is returned in the UI and logged through `EMAIL_MODE=console`
- the Worker is prepared to switch to a real mail provider later without changing the frontend flow

To enable Zoho sending in the Worker, configure:

- `EMAIL_MODE=zoho`
- `APP_ORIGIN`
- `ZOHO_EMAIL`
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- optional: `ZOHO_ACCOUNT_ID`

Legacy FastAPI, portal, admin, auth, scan, and deployment code has been moved to [backup/legacy-2026-04-04](/Users/wei/GitHub/MythicalHelper/backup/legacy-2026-04-04).

## License

MIT License.
