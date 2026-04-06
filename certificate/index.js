const DEFAULT_REALMS = [
  "Wonderkeeping Office",
  "North Pole Auxiliary",
  "Tooth Fairy Liaison",
  "Spring Bunny Service",
];
const DEFAULT_AGENT_NAME = "Agent [Name]";
const DEFAULT_WATCH_OVER = "Cherished Name or Names";

function resolveApiBase() {
  const { hostname, port, protocol } = window.location;
  if ((hostname === "localhost" || hostname === "127.0.0.1") && port && port !== "8787") {
    return `${protocol}//${hostname}:8787/api`;
  }
  return "https://api.mythicalhelper.org/api";
}

const API_BASE = resolveApiBase();

function readSavedRealms(draft) {
  if (Array.isArray(draft?.realms) && draft.realms.length) {
    return draft.realms;
  }
  if (Array.isArray(draft?.divisions) && draft.divisions.length) {
    return draft.divisions;
  }
  if (draft?.realm) {
    return [draft.realm];
  }
  if (draft?.division) {
    return [draft.division];
  }
  return DEFAULT_REALMS;
}

function readDraft() {
  const raw = localStorage.getItem("mh_certificate_draft");
  if (!raw) {
    return {
      email: "",
      agentName: DEFAULT_AGENT_NAME,
      realms: DEFAULT_REALMS,
      watchOver: DEFAULT_WATCH_OVER,
      issuedOn: new Date().toISOString(),
    };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function requestJson(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

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

function buildVerifyUrl(draft) {
  if (draft.verifyUrl) {
    return draft.verifyUrl;
  }
  const url = new URL("/verify/", window.location.origin);
  url.searchParams.set("agent", draft.agentName || DEFAULT_AGENT_NAME);
  url.searchParams.set("realms", readSavedRealms(draft).join(" | "));
  url.searchParams.set("watch", draft.watchOver || DEFAULT_WATCH_OVER);
  url.searchParams.set("issued", draft.issuedOn || new Date().toISOString());
  return url.toString();
}

function renderQr(target, text) {
  target.innerHTML = "";
  new QRCode(target, {
    text,
    width: 96,
    height: 96,
    colorDark: "#111111",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M,
  });
}

const SIGNATURES_BY_REALM = {
  "North Pole Auxiliary": {
    signature: "St. Nicholas",
    legend: "The North Pole",
    label: "Santa's Mark",
    className: "santa-signature",
  },
  "Tooth Fairy Liaison": {
    signature: `
      <span class="fairy-signature-wrap">
        <span>Faye</span>
        <svg class="hand-drawn-star" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 2 L12.5 7.5 L18.5 7.5 L14 11 L15.5 17 L10 13.5 L4.5 17 L6 11 L1.5 7.5 L7.5 7.5 Z"
            fill="rgba(138, 43, 226, 0.9)"
            stroke="rgba(138, 43, 226, 0.9)"
            stroke-width="0.5"></path>
        </svg>
      </span>
    `,
    legend: "The Tooth Fairy's Realm",
    label: "Fairy's Mark",
    className: "fairy-signature",
  },
  "Spring Bunny Service": {
    signature: `
      <svg class="bunny-paw" viewBox="0 0 40 40" aria-hidden="true">
        <ellipse cx="20" cy="25" rx="8" ry="6" fill="rgba(139, 69, 19, 0.9)"></ellipse>
        <ellipse cx="12" cy="15" rx="3" ry="4" fill="rgba(139, 69, 19, 0.9)"></ellipse>
        <ellipse cx="20" cy="12" rx="3" ry="4" fill="rgba(139, 69, 19, 0.9)"></ellipse>
        <ellipse cx="28" cy="15" rx="3" ry="4" fill="rgba(139, 69, 19, 0.9)"></ellipse>
        <ellipse cx="16" cy="8" rx="2.5" ry="3" fill="rgba(139, 69, 19, 0.9)"></ellipse>
        <ellipse cx="24" cy="8" rx="2.5" ry="3" fill="rgba(139, 69, 19, 0.9)"></ellipse>
      </svg>
    `,
    legend: "Easter Meadow",
    label: "Bunny's Mark",
    className: "bunny-signature bunny-signature-mark",
  },
  "Wonderkeeping Office": {
    signature: "Council Keeper",
    legend: "The Wonder Realm",
    label: "Council's Mark",
    className: "warden-signature",
  },
};

function splitWatchNames(value) {
  return String(value || "")
    .split(/[,\n;&]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatNameList(value) {
  const names = Array.isArray(value) ? value : splitWatchNames(value);
  if (names.length === 0) {
    return DEFAULT_WATCH_OVER;
  }
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function signaturesForRealms(realms) {
  const seen = new Set();
  return realms
    .map((realm) => SIGNATURES_BY_REALM[realm])
    .filter(Boolean)
    .filter((entry) => {
      const key = `${entry.signature}-${entry.label}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function signatureColumns(count) {
  if (count <= 1) return 1;
  if (count <= 5) return count;
  return Math.min(5, Math.ceil(count / 2));
}

function renderSignatures(target, signatures) {
  if (!target) {
    return;
  }

  const entries = signatures.length
    ? signatures
    : [{ signature: "Guild Warden", legend: "Wonderkeeping", label: "Guild Mark", className: "warden-signature" }];

  target.style.setProperty("--signature-columns", String(signatureColumns(entries.length)));
  target.innerHTML = entries
    .map(
      (entry) => `
        <div class="signature-item">
          <div class="sig-realm">${entry.legend}</div>
          <div class="${entry.className}">${entry.signature}</div>
          <div class="sig-line"></div>
          <div class="sig-name">${entry.label}</div>
        </div>
      `
    )
    .join("");
}

async function downloadPdf() {
  const card = document.getElementById("certificateCard");
  const button = document.getElementById("downloadPdf");
  if (!card || !button) {
    return;
  }

  const originalLabel = button.textContent;
  button.textContent = "Preparing...";
  button.disabled = true;

  try {
    const canvas = await html2canvas(card, {
      scale: 2,
      backgroundColor: "#f6f0df",
      useCORS: true,
    });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "letter",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const width = canvas.width * ratio;
    const height = canvas.height * ratio;
    const x = (pageWidth - width) / 2;
    const y = (pageHeight - height) / 2;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, width, height);
    pdf.save("mythical-helper-certificate.pdf");
  } finally {
    button.textContent = originalLabel;
    button.disabled = false;
  }
}

async function loadRecord() {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get("access") || localStorage.getItem("mh_access_token");
  if (accessToken) {
    try {
      const payload = await requestJson(`/records/access/${encodeURIComponent(accessToken)}`);
      const draft = {
        email: payload.record.email || "",
        agentName: payload.record.agentName,
        realms: payload.record.realms,
        watchOver: payload.record.watchOver,
        issuedOn: payload.record.issuedOn,
        accessToken: payload.record.accessToken,
        verifyToken: payload.record.verifyToken,
        verifyUrl: payload.record.verifyUrl,
        certificateUrl: payload.record.certificateUrl,
      };
      localStorage.setItem("mh_certificate_draft", JSON.stringify(draft));
      localStorage.setItem("mh_access_token", payload.record.accessToken);
      return draft;
    } catch {
      // Fall back to local draft for the current static prototype.
    }
  }

  try {
    const session = await requestJson("/session");
    const draft = {
      email: session.record.email || "",
      agentName: session.record.agentName,
      realms: session.record.realms,
      watchOver: session.record.watchOver,
      issuedOn: session.record.issuedOn,
      accessToken: session.record.accessToken,
      verifyToken: session.record.verifyToken,
      verifyUrl: session.record.verifyUrl,
      certificateUrl: session.record.certificateUrl,
    };
    localStorage.setItem("mh_certificate_draft", JSON.stringify(draft));
    localStorage.setItem("mh_access_token", session.record.accessToken);
    return draft;
  } catch {
    // Fall back to local draft.
  }

  return readDraft();
}

async function init() {
  const draft = await loadRecord();
  if (!draft) {
    window.location.href = "/access/";
    return;
  }

  const realms = readSavedRealms(draft);
  const watchOverNames = formatNameList(draft.watchOver);
  document.getElementById("certAgent").textContent = draft.agentName || DEFAULT_AGENT_NAME;
  document.getElementById("certDate").textContent = formatDate(draft.issuedOn);
  document.getElementById("certWatchOver").textContent = watchOverNames;
  renderSignatures(document.getElementById("signatureGrid"), signaturesForRealms(realms));
  document.getElementById("downloadPdf")?.addEventListener("click", downloadPdf);

  const verifyUrl = buildVerifyUrl(draft);
  renderQr(document.getElementById("certificateQR"), verifyUrl);
}

init();
