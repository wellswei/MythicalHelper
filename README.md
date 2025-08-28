Mythical Helper (Frontend)
==========================

Static frontend for mythicalhelper.org, hosted on Cloudflare Pages. Implements the full UX flow with a mock API to run end-to-end before wiring the real backend.

What’s here
-----------
- index.html: Landing with navigation.
- register.html: Email OTP + Turnstile (token optional in mock).
- verify-phone.html: SMS OTP (mock SNS).
- generate.html: Choose role and child display policy, generate certificate.
- check.html: Verify certificate by serial or QR link.
- assets/config.js: Runtime config (mock/real API, Turnstile sitekey).
- assets/app.js: Shared helpers + API chooser.
- assets/mockApi.js: Local mock implementation using localStorage/sessionStorage.
- assets/styles.css: Simple, responsive UI styles.

Local usage
-----------
1) Serve the folder with any static server (or open files directly):
   - Python: `python3 -m http.server 8787` then visit http://localhost:8787
   - Node: `npx serve .`

2) The default config uses the mock API, so you can:
   - Go to register.html → send/verify email OTP (OTP is logged to devtools console).
   - Proceed to verify-phone.html → send/verify SMS OTP (also logged).
   - Go to generate.html → create a certificate; you’ll see serial + QR.
   - Visit check.html or open the provided link to view status.

Turnstile
---------
- Add your public sitekey in `assets/config.js` at `turnstileSiteKey`.
- In mock mode, token is not validated; real backend should validate server-side.

Switch to real backend
----------------------
- Set `useMockApi: false` and `apiBase: "https://api.mythicalhelper.org"` in `assets/config.js`.
- Expected endpoints (to be provided by FastAPI):
  - POST `/auth/email/send-otp` { email, turnstile_token }
  - POST `/auth/email/verify` { email, code }
  - POST `/auth/sms/send-otp` { phone }
  - POST `/auth/sms/verify` { phone, code }
  - POST `/certificates` { role, child_name?, display_policy }
  - GET  `/certificates/{serial}`

Cloudflare Pages
----------------
- Deploy this repo directly; Pages will serve these static files.
- Custom domain mythicalhelper.org is already mapped.
- Later, use Pages Functions or separate AWS backend; this frontend consumes whichever `apiBase` you point it to.

Notes
-----
- QR image is generated via a public QR service as a placeholder. Replace with a backend-generated QR embedded in the PDF when available.
- No frameworks or bundlers are used for simplicity.
