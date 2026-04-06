function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const DEFAULT_REALMS = [
  "Wonderkeeping Office",
  "North Pole Auxiliary",
  "Tooth Fairy Liaison",
  "Spring Bunny Service",
];

function resolveApiBase() {
  const { hostname, port, protocol } = window.location;
  if ((hostname === "localhost" || hostname === "127.0.0.1") && port && port !== "8787") {
    return `${protocol}//${hostname}:8787/api`;
  }
  return "https://api.mythicalhelper.org/api";
}

const API_BASE = resolveApiBase();

const REALM_LABELS = {
  "Wonderkeeping Office": "The Wonder Realm",
  "North Pole Auxiliary": "The North Pole",
  "Tooth Fairy Liaison": "The Tooth Fairy's Realm",
  "Spring Bunny Service": "Easter Meadow",
};

function normalizeRealms(value) {
  return String(value || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function displayRealms(value) {
  const realms = Array.isArray(value) ? value : normalizeRealms(value);
  return realms.map((realm) => REALM_LABELS[realm] || realm);
}

function getRealmTone(label) {
  if (label === "The Wonder Realm") return "wonder";
  if (label === "The North Pole") return "north";
  if (label === "The Tooth Fairy's Realm") return "fairy";
  if (label === "Easter Meadow") return "easter";
  return "neutral";
}

function loadDraft() {
  const raw = localStorage.getItem("mh_certificate_draft");
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function requestJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const verifyToken = params.get("token");
  const isDemo = params.get("demo") === "1";
  const hasParams = Array.from(params.keys()).length > 0;
  const draft = loadDraft();

  const record = {
    agent: params.get("agent") || draft?.agentName || "A trusted helper",
    realms:
      params.get("realms") ||
      params.get("divisions") ||
      (draft?.realms || draft?.divisions || DEFAULT_REALMS).join(" | "),
    watch: params.get("watch") || draft?.watchOver || "Cherished Name or Names",
    issued: params.get("issued") || draft?.issuedOn || new Date().toISOString(),
    status: "Valid",
  };

  if (verifyToken) {
    try {
      const payload = await requestJson(`/records/verify/${encodeURIComponent(verifyToken)}`);
      record.agent = payload.record.agentName;
      record.realms = payload.record.realms.join(" | ");
      record.watch = payload.record.watchOver;
      record.issued = payload.record.issuedOn;
      record.status = payload.record.status === "active" ? "Valid" : payload.record.status;
    } catch {
      // Fall back to local/demo behavior.
    }
  }

  if (isDemo) {
    record.agent = "Demo Parent";
    record.realms = DEFAULT_REALMS.join(" | ");
    record.watch = "Lulu, June, and Theo";
  }

  if (!hasParams && !draft) {
    record.agent = "Demo Parent";
    record.realms = DEFAULT_REALMS.join(" | ");
    record.watch = "Cherished Name or Names";
  }

  document.getElementById("verifyAgentName").textContent = record.agent;
  document.getElementById("verifyWatchOver").textContent = record.watch;
  document.getElementById("verifyIssuedOn").textContent = formatDate(record.issued);
  document.getElementById("verifyStatusText").textContent = record.status;

  document.getElementById("verifyTags").innerHTML = displayRealms(record.realms)
    .map((label) => `<span class="verify-tag verify-tag-${getRealmTone(label)}">${label}</span>`)
    .join("");
}

init();
