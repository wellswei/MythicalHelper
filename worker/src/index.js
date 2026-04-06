const DEFAULT_REALMS = [
  "Wonderkeeping Office",
  "North Pole Auxiliary",
  "Tooth Fairy Liaison",
  "Spring Bunny Service",
];
const SESSION_COOKIE = "mh_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 14;
const MAGIC_LINK_MAX_AGE_MS = 1000 * 60 * 20;

function getAllowedOrigin(request) {
  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin) {
    return requestOrigin;
  }

  const url = new URL(request.url);
  if ((url.hostname === "localhost" || url.hostname === "127.0.0.1") && url.port === "8787") {
    return `${url.protocol}//${url.hostname}:8000`;
  }

  return url.origin;
}

function isLocalOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function applyCorsHeaders(request, headers) {
  headers.set("access-control-allow-origin", getAllowedOrigin(request));
  headers.set("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  headers.set("access-control-allow-headers", "Content-Type");
  headers.set("access-control-allow-credentials", "true");
  headers.set("vary", "Origin");
}

function appOrigin(request, env) {
  if (env.APP_ORIGIN) {
    return env.APP_ORIGIN;
  }
  return getAllowedOrigin(request);
}

function json(request, data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  applyCorsHeaders(request, headers);
  return new Response(JSON.stringify(data), { ...init, headers });
}

function redirect(request, location, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("location", location);
  applyCorsHeaders(request, headers);
  return new Response(null, { ...init, status: init.status || 302, headers });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeText(value, fallback = "") {
  return String(value || fallback).trim();
}

function normalizeRealms(value) {
  const realms = Array.isArray(value) ? value : [];
  const cleaned = realms.map((item) => normalizeText(item)).filter(Boolean);
  if (!cleaned.includes("Wonderkeeping Office")) {
    cleaned.unshift("Wonderkeeping Office");
  }
  const unique = [];
  for (const realm of cleaned) {
    if (!unique.includes(realm)) {
      unique.push(realm);
    }
  }
  return unique.length ? unique : DEFAULT_REALMS;
}

function buildToken(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function parseCookies(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        const key = index === -1 ? part : part.slice(0, index);
        const value = index === -1 ? "" : part.slice(index + 1);
        return [key, decodeURIComponent(value)];
      })
  );
}

function buildSessionCookie(token) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE}`,
  ];
  return parts.join("; ");
}

function buildSessionClearCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function frontendOriginForRequest(request) {
  return getAllowedOrigin(request);
}

async function sendMagicLinkEmail(env, payload) {
  const mode = String(env.EMAIL_MODE || "console").toLowerCase();
  if (mode === "console") {
    console.log(
      JSON.stringify({
        type: "magic_link_email",
        to: payload.email,
        subject: "Return to your MythicalHelper record",
        magicLink: payload.magicLink,
      })
    );
    return { delivered: true, mode: "console" };
  }

  if (mode === "zoho") {
    const accessToken = await getZohoAccessToken(env);
    const accountId = await getZohoAccountId(env, accessToken);
    await sendZohoMessage(env, accessToken, accountId, payload);
    return { delivered: true, mode: "zoho" };
  }

  return { delivered: false, mode: "unknown" };
}

async function getZohoAccessToken(env) {
  const clientId = env.ZOHO_CLIENT_ID;
  const clientSecret = env.ZOHO_CLIENT_SECRET;
  const refreshToken = env.ZOHO_REFRESH_TOKEN;
  const accountsBase = env.ZOHO_ACCOUNTS_BASE || "https://accounts.zoho.com";

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Zoho email mode is enabled, but Zoho credentials are missing.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch(`${accountsBase}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(`Zoho access token refresh failed: ${response.status}`);
  }

  return payload.access_token;
}

async function getZohoAccountId(env, accessToken) {
  if (env.ZOHO_ACCOUNT_ID) {
    return env.ZOHO_ACCOUNT_ID;
  }

  const mailApiBase = env.ZOHO_MAIL_API_BASE || "https://mail.zoho.com/api";
  const fromAddress = env.ZOHO_EMAIL;
  const response = await fetch(`${mailApiBase}/accounts`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Zoho accounts lookup failed: ${response.status}`);
  }

  const accounts = payload.data || [];
  if (!accounts.length) {
    throw new Error("No Zoho mail accounts were returned.");
  }

  if (fromAddress) {
    const matched = accounts.find((account) => account.emailAddress === fromAddress);
    if (matched?.accountId) {
      return String(matched.accountId);
    }
  }

  return String(accounts[0].accountId);
}

function buildMagicLinkEmailHtml(payload) {
  return `
    <div style="margin:0;padding:32px 20px;background:#0b1020;font-family:Inter,Arial,sans-serif;color:#eef2ff;">
      <div style="max-width:620px;margin:0 auto;background:#11192a;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:32px 28px;">
        <div style="letter-spacing:.28em;text-transform:uppercase;font-size:12px;color:#efd7a2;margin-bottom:14px;">Mythical Helper Guild</div>
        <h1 style="margin:0 0 16px;font-family:'Cinzel Decorative',Georgia,serif;font-size:34px;line-height:1.1;color:#efd7a2;">Return To Your Record</h1>
        <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#eef2ff;">
          A return link was requested for the guild record kept under this email.
        </p>
        <p style="margin:0 0 22px;font-size:16px;line-height:1.65;color:#c9d5ea;">
          Open the link below to re-enter the record, revise it, and prepare the certificate again.
        </p>
        <p style="margin:0 0 24px;">
          <a href="${payload.magicLink}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#5c72c9;color:#eef2ff;text-decoration:none;font-weight:700;">
            Open The Record
          </a>
        </p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:rgba(238,242,255,.72);word-break:break-all;">
          ${payload.magicLink}
        </p>
      </div>
    </div>
  `;
}

function buildMagicLinkEmailText(payload) {
  return [
    "Mythical Helper Guild",
    "",
    "A return link was requested for the guild record kept under this email.",
    "Open the link below to re-enter the record, revise it, and prepare the certificate again.",
    "",
    payload.magicLink,
  ].join("\n");
}

async function sendZohoMessage(env, accessToken, accountId, payload) {
  const mailApiBase = env.ZOHO_MAIL_API_BASE || "https://mail.zoho.com/api";
  const fromAddress = env.ZOHO_EMAIL;
  if (!fromAddress) {
    throw new Error("Zoho email mode is enabled, but ZOHO_EMAIL is missing.");
  }

  const message = {
    fromAddress,
    toAddress: payload.email,
    subject: "Return to your MythicalHelper record",
    content: buildMagicLinkEmailHtml(payload),
    askReceipt: "no",
    mailFormat: "html",
  };

  const response = await fetch(`${mailApiBase}/accounts/${accountId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zoho send failed: ${response.status} ${text}`);
  }

  return true;
}

function rowToRecord(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    agentName: row.agent_name,
    watchOver: row.watch_over,
    realms: JSON.parse(row.realms_json),
    accessToken: row.access_token,
    verifyToken: row.verify_token,
    status: row.status,
    createdAt: row.created_at,
    issuedOn: row.issued_at,
    updatedAt: row.updated_at,
  };
}

function publicRecord(record, origin) {
  return {
    email: record.email,
    agentName: record.agentName,
    watchOver: record.watchOver,
    realms: record.realms,
    accessToken: record.accessToken,
    verifyToken: record.verifyToken,
    issuedOn: record.issuedOn,
    status: record.status,
    certificateUrl: `${origin}/certificate/?access=${encodeURIComponent(record.accessToken)}`,
    verifyUrl: `${origin}/verify/?token=${encodeURIComponent(record.verifyToken)}`,
  };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function fetchByAccessToken(db, token) {
  const row = await db
    .prepare("SELECT * FROM records WHERE access_token = ?1 LIMIT 1")
    .bind(token)
    .first();
  return rowToRecord(row);
}

async function fetchByVerifyToken(db, token) {
  const row = await db
    .prepare("SELECT * FROM records WHERE verify_token = ?1 LIMIT 1")
    .bind(token)
    .first();
  return rowToRecord(row);
}

async function fetchByEmail(db, email) {
  const row = await db
    .prepare("SELECT * FROM records WHERE email_normalized = ?1 LIMIT 1")
    .bind(normalizeEmail(email))
    .first();
  return rowToRecord(row);
}

async function fetchSessionRecord(request, db) {
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) {
    return null;
  }
  return fetchByAccessToken(db, token);
}

async function createRecord(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const agentName = normalizeText(body.agentName);
  const watchOver = normalizeText(body.watchOver);
  const realms = normalizeRealms(body.realms);

  if (!email || !agentName || !watchOver) {
    return json(request, { error: "Missing required fields." }, { status: 400 });
  }

  const existing = await fetchByEmail(env.DB, email);
  if (existing) {
    return json(request, { error: "A guild record already exists for this email." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    email,
    agentName,
    watchOver,
    realms,
    accessToken: buildToken("access"),
    verifyToken: buildToken("verify"),
    status: "active",
    createdAt: now,
    issuedOn: now,
    updatedAt: now,
  };

  await env.DB.prepare(
    `INSERT INTO records (
      id, email, email_normalized, agent_name, watch_over, realms_json,
      access_token, verify_token, status, created_at, issued_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
  )
    .bind(
      record.id,
      record.email,
      normalizeEmail(record.email),
      record.agentName,
      record.watchOver,
      JSON.stringify(record.realms),
      record.accessToken,
      record.verifyToken,
      record.status,
      record.createdAt,
      record.issuedOn,
      record.updatedAt
    )
    .run();

  return json(request, { record: publicRecord(record, frontendOriginForRequest(request)) }, { status: 201 });
}

async function retrieveRecord(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  if (!email) {
    return json(request, { error: "Email is required." }, { status: 400 });
  }

  const record = await fetchByEmail(env.DB, email);
  if (!record) {
    return json(request, { error: "No guild record was found for this email yet." }, { status: 404 });
  }

  return json(request, { record: publicRecord(record, frontendOriginForRequest(request)) });
}

async function readAccessRecord(request, env, token) {
  const record = await fetchByAccessToken(env.DB, token);
  if (!record) {
    return json(request, { error: "Record not found." }, { status: 404 });
  }
  return json(request, { record: publicRecord(record, frontendOriginForRequest(request)) });
}

async function updateAccessRecord(request, env, token) {
  const existing = await fetchByAccessToken(env.DB, token);
  if (!existing) {
    return json(request, { error: "Record not found." }, { status: 404 });
  }

  const body = await readJson(request);
  const agentName = normalizeText(body.agentName, existing.agentName);
  const watchOver = normalizeText(body.watchOver, existing.watchOver);
  const realms = normalizeRealms(body.realms || existing.realms);
  const updatedAt = new Date().toISOString();

  await env.DB.prepare(
    `UPDATE records
      SET agent_name = ?1, watch_over = ?2, realms_json = ?3, updated_at = ?4
      WHERE access_token = ?5`
  )
    .bind(agentName, watchOver, JSON.stringify(realms), updatedAt, token)
    .run();

  const record = {
    ...existing,
    agentName,
    watchOver,
    realms,
    updatedAt,
  };

  return json(request, { record: publicRecord(record, frontendOriginForRequest(request)) });
}

async function readVerifyRecord(request, env, token) {
  const record = await fetchByVerifyToken(env.DB, token);
  if (!record) {
    return json(request, { error: "Record not found." }, { status: 404 });
  }
  return json(request, {
    record: {
      agentName: record.agentName,
      watchOver: record.watchOver,
      realms: record.realms,
      issuedOn: record.issuedOn,
      status: record.status,
    },
  });
}

async function deleteAccessRecord(request, env, token) {
  const existing = await fetchByAccessToken(env.DB, token);
  if (!existing) {
    return json(request, { error: "Record not found." }, { status: 404 });
  }

  await env.DB.prepare("DELETE FROM records WHERE access_token = ?1").bind(token).run();
  return json(request, { ok: true }, { headers: { "set-cookie": buildSessionClearCookie() } });
}

async function createSessionRecord(request, env) {
  const created = await createRecord(request, env);
  if (created.status >= 400) {
    return created;
  }
  const payload = await created.clone().json();
  return json(request, payload, {
    status: 201,
    headers: {
      "set-cookie": buildSessionCookie(payload.record.accessToken),
    },
  });
}

async function requestMagicLink(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  if (!email) {
    return json(request, { error: "Email is required." }, { status: 400 });
  }

  const record = await fetchByEmail(env.DB, email);
  if (!record) {
    return json(request, { error: "No guild record was found for this email yet." }, { status: 404 });
  }

  const token = buildToken("magic");
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_MAX_AGE_MS).toISOString();
  await env.DB.prepare(
    `INSERT INTO magic_links (token, record_id, email_normalized, expires_at, consumed_at, created_at)
     VALUES (?1, ?2, ?3, ?4, NULL, ?5)`
  )
    .bind(token, record.id, normalizeEmail(record.email), expiresAt, createdAt)
    .run();

  const verifyUrl = new URL("/api/auth/verify", new URL(request.url).origin);
  verifyUrl.searchParams.set("token", token);

  await sendMagicLinkEmail(env, {
    email: record.email,
    magicLink: verifyUrl.toString(),
  });

  const response = {
    ok: true,
    message: "A return link has been prepared for this email.",
  };

  if (isLocalOrigin(appOrigin(request, env))) {
    response.magicLink = verifyUrl.toString();
  }

  return json(request, response);
}

async function verifyMagicLink(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return json(request, { error: "Missing token." }, { status: 400 });
  }

  const link = await env.DB.prepare("SELECT * FROM magic_links WHERE token = ?1 LIMIT 1").bind(token).first();
  if (!link) {
    return json(request, { error: "Magic link not found." }, { status: 404 });
  }

  if (link.consumed_at) {
    return json(request, { error: "This magic link has already been used." }, { status: 410 });
  }

  if (new Date(link.expires_at).getTime() < Date.now()) {
    return json(request, { error: "This magic link has expired." }, { status: 410 });
  }

  const recordRow = await env.DB.prepare("SELECT * FROM records WHERE id = ?1 LIMIT 1").bind(link.record_id).first();
  const record = rowToRecord(recordRow);
  if (!record) {
    return json(request, { error: "Record not found." }, { status: 404 });
  }

  await env.DB.prepare("UPDATE magic_links SET consumed_at = ?1 WHERE token = ?2")
    .bind(new Date().toISOString(), token)
    .run();

  const destination = new URL("/access/", appOrigin(request, env));
  destination.searchParams.set("verified", "1");
  return redirect(request, destination.toString(), {
    status: 302,
    headers: {
      "set-cookie": buildSessionCookie(record.accessToken),
    },
  });
}

async function readSession(request, env) {
  const record = await fetchSessionRecord(request, env.DB);
  if (!record) {
    return json(request, { error: "No active session." }, { status: 401 });
  }
  return json(request, { record: publicRecord(record, frontendOriginForRequest(request)) });
}

async function logoutSession(request) {
  return json(request, { ok: true }, { headers: { "set-cookie": buildSessionClearCookie() } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return json(request, { ok: true });
    }

    if (!env.DB) {
      return json(request, { error: "D1 binding is missing." }, { status: 500 });
    }

    if (path === "/api/health" && request.method === "GET") {
      return json(request, { ok: true });
    }

    if (path === "/api/session" && request.method === "GET") {
      return readSession(request, env);
    }

    if (path === "/api/session/logout" && request.method === "POST") {
      return logoutSession(request);
    }

    if (path === "/api/auth/signup" && request.method === "POST") {
      return createSessionRecord(request, env);
    }

    if (path === "/api/auth/request-link" && request.method === "POST") {
      return requestMagicLink(request, env);
    }

    if (path === "/api/auth/verify" && request.method === "GET") {
      return verifyMagicLink(request, env);
    }

    if (path === "/api/records" && request.method === "POST") {
      return createRecord(request, env);
    }

    if (path === "/api/records/retrieve" && request.method === "POST") {
      return retrieveRecord(request, env);
    }

    const accessMatch = path.match(/^\/api\/records\/access\/([^/]+)$/);
    if (accessMatch) {
      if (request.method === "GET") {
        return readAccessRecord(request, env, accessMatch[1]);
      }
      if (request.method === "PATCH") {
        return updateAccessRecord(request, env, accessMatch[1]);
      }
      if (request.method === "DELETE") {
        return deleteAccessRecord(request, env, accessMatch[1]);
      }
    }

    const verifyMatch = path.match(/^\/api\/records\/verify\/([^/]+)$/);
    if (verifyMatch && request.method === "GET") {
      return readVerifyRecord(request, env, verifyMatch[1]);
    }

    return json(request, { error: "Not found." }, { status: 404 });
  },
};
