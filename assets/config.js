// Basic runtime config for the frontend. Adjust before deploy.
window.MH_CONFIG = {
  // When true, uses mock API implemented in assets/mockApi.js
  useMockApi: true,
  // Point to your FastAPI backend when ready, e.g. https://api.mythicalhelper.org
  apiBase: "",
  // Cloudflare Turnstile sitekey (public). In mock mode, token is not required.
  turnstileSiteKey: "0x00000000000000000000000000000000",
};
