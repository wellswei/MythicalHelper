const form = document.getElementById("accessForm");
const statusLine = document.getElementById("formStatus");
const accessChoiceGrid = document.getElementById("accessChoiceGrid");
const newMemberChoice = document.getElementById("newMemberChoice");
const returningAgentChoice = document.getElementById("returningAgentChoice");
const newMemberPanel = document.getElementById("newMemberPanel");
const returningAgentPanel = document.getElementById("returningAgentPanel");
const returningForm = document.getElementById("returningForm");
const returningStatus = document.getElementById("returningStatus");
const returningEmailInput = document.getElementById("returningEmail");
const editModeGrid = document.getElementById("editModeGrid");
const deleteRecordButton = document.getElementById("deleteRecordButton");
const leaveRecordButton = document.getElementById("leaveRecordButton");
const submitRecordButton = document.getElementById("submitRecordButton");
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

function clearLocalRecord() {
  localStorage.removeItem("mh_certificate_draft");
  localStorage.removeItem("mh_access_token");
}

function getSelectedRealms() {
  const selected = Array.from(form?.querySelectorAll('input[name="realms"]:checked') || []).map(
    (input) => input.value
  );
  if (!selected.includes("Wonderkeeping Office")) {
    selected.unshift("Wonderkeeping Office");
  }
  return selected;
}

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

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

function saveLocalRecord(record) {
  if (!record) {
    return;
  }
  const draft = {
    email: record.email || "",
    agentName: record.agentName || "",
    realms: readSavedRealms(record),
    watchOver: record.watchOver || "",
    issuedOn: record.issuedOn || new Date().toISOString(),
    accessToken: record.accessToken || "",
    verifyToken: record.verifyToken || "",
    verifyUrl: record.verifyUrl || "",
    certificateUrl: record.certificateUrl || "",
  };
  localStorage.setItem("mh_certificate_draft", JSON.stringify(draft));
  if (draft.accessToken) {
    localStorage.setItem("mh_access_token", draft.accessToken);
  }
}

function buildCertificatePath(accessToken) {
  const url = new URL("/certificate/", window.location.origin);
  if (accessToken) {
    url.searchParams.set("access", accessToken);
  }
  return url.toString();
}

function setMode(mode) {
  const isEditing = mode === "edit";
  const isReturning = mode === "returning";
  if (accessChoiceGrid) {
    accessChoiceGrid.hidden = isEditing;
  }
  newMemberChoice?.classList.toggle("is-active", !isReturning);
  returningAgentChoice?.classList.toggle("is-active", isReturning);
  if (editModeGrid) {
    editModeGrid.hidden = !isEditing;
  }

  if (statusLine) {
    statusLine.textContent = "";
  }
  if (returningStatus) {
    returningStatus.textContent = "";
  }

  if (newMemberPanel) {
    newMemberPanel.hidden = isReturning;
    newMemberPanel.classList.toggle("access-panel-active", !isReturning);
  }

  if (returningAgentPanel) {
    returningAgentPanel.hidden = !isReturning || isEditing;
    returningAgentPanel.classList.toggle("access-panel-active", isReturning && !isEditing);
  }

  if (!isReturning) {
    window.setTimeout(() => form?.email?.focus(), 0);
  }

  if (isReturning && !isEditing) {
    window.setTimeout(() => returningEmailInput?.focus(), 0);
  }

  if (submitRecordButton) {
    submitRecordButton.textContent = isEditing ? "Update The Record" : "Join The Guild";
    submitRecordButton.classList.toggle("button-update-accent", isEditing);
    submitRecordButton.classList.toggle("button-signup-accent", !isEditing);
  }
  if (form?.email) {
    form.email.readOnly = isEditing;
  }
}

async function loadExistingRecord() {
  const params = new URLSearchParams(window.location.search);
  const accessToken = params.get("access") || localStorage.getItem("mh_access_token");
  if (!accessToken) {
    return loadDraft();
  }

  try {
    const payload = await requestJson(`/records/access/${encodeURIComponent(accessToken)}`, {
      method: "GET",
    });
    saveLocalRecord(payload.record);
    return loadDraft();
  } catch {
    return loadDraft();
  }
}

function fillForm(existingDraft) {
  if (!existingDraft || !form) {
    return;
  }
  form.email.value = existingDraft.email || "";
  form.agentName.value = existingDraft.agentName || "";
  form.watchOver.value = existingDraft.watchOver || "";

  const savedRealms = readSavedRealms(existingDraft);

  form.querySelectorAll('input[name="realms"]').forEach((input) => {
    input.checked = savedRealms.includes(input.value);
  });
  const requiredRealm = form.querySelector('input[name="realms"][value="Wonderkeeping Office"]');
  if (requiredRealm) {
    requiredRealm.checked = true;
  }

  if (returningEmailInput) {
    returningEmailInput.value = existingDraft.email || "";
  }
}

function seedDefaults() {
  if (!form) {
    return;
  }
  form.querySelectorAll('input[name="realms"]').forEach((input) => {
    input.checked = DEFAULT_REALMS.includes(input.value);
  });
  const requiredRealm = form.querySelector('input[name="realms"][value="Wonderkeeping Office"]');
  if (requiredRealm) {
    requiredRealm.checked = true;
  }
}

let existingDraft = null;

newMemberChoice?.addEventListener("click", () => {
  setMode("new");
});

returningAgentChoice?.addEventListener("click", () => {
  setMode("returning");
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const realms = getSelectedRealms();
  if (realms.length === 0) {
    statusLine.textContent = "Select at least one realm before continuing.";
    return;
  }

  const data = new FormData(form);
  const draft = {
    email: String(data.get("email") || "").trim(),
    agentName: String(data.get("agentName") || "").trim(),
    realms,
    watchOver: String(data.get("watchOver") || "").trim(),
    issuedOn: existingDraft?.issuedOn || new Date().toISOString(),
  };

  try {
    const accessToken = existingDraft?.accessToken || localStorage.getItem("mh_access_token");
    const isEditing = Boolean(accessToken);
    statusLine.textContent = isEditing ? "Updating guild record..." : "Creating guild record...";
    const payload = isEditing
      ? await requestJson(`/records/access/${encodeURIComponent(accessToken)}`, {
          method: "PATCH",
          body: JSON.stringify({
            agentName: draft.agentName,
            watchOver: draft.watchOver,
            realms: draft.realms,
          }),
        })
      : await requestJson("/auth/signup", {
          method: "POST",
          body: JSON.stringify({
            email: draft.email,
            agentName: draft.agentName,
            watchOver: draft.watchOver,
            realms: draft.realms,
          }),
        });
    saveLocalRecord(payload.record);
    existingDraft = loadDraft();
    statusLine.textContent = "Record created. Opening the certificate...";
    window.setTimeout(() => {
      window.location.href = buildCertificatePath(payload.record.accessToken);
    }, 250);
  } catch (error) {
    localStorage.setItem("mh_certificate_draft", JSON.stringify(draft));
    statusLine.textContent = error.message || "Unable to create the record right now.";
  }
});

returningForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = String(new FormData(returningForm).get("returningEmail") || "").trim();
  try {
    returningStatus.textContent = "Preparing a return link...";
    const payload = await requestJson("/auth/request-link", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    if (payload.magicLink) {
      returningStatus.innerHTML = `Return link ready. <a href="${payload.magicLink}" target="_self" rel="noopener">Open the link</a>`;
      return;
    }
    returningStatus.textContent = "A return link has been sent. Open it from your email to continue.";
  } catch (error) {
    returningStatus.textContent = error.message || "Unable to retrieve the record right now.";
  }
});

deleteRecordButton?.addEventListener("click", async () => {
  const accessToken = existingDraft?.accessToken || localStorage.getItem("mh_access_token");
  if (!accessToken) {
    return;
  }
  const confirmed = window.confirm("Delete this guild record? This cannot be undone.");
  if (!confirmed) {
    return;
  }

  try {
    statusLine.textContent = "Deleting guild record...";
    await requestJson(`/records/access/${encodeURIComponent(accessToken)}`, {
      method: "DELETE",
    });
    clearLocalRecord();
    statusLine.textContent = "";
    seedDefaults();
    form.reset();
    fillForm({ realms: DEFAULT_REALMS });
    existingDraft = null;
    setMode("new");
  } catch (error) {
    statusLine.textContent = error.message || "Unable to delete the guild record right now.";
  }
});

leaveRecordButton?.addEventListener("click", () => {
  requestJson("/session/logout", { method: "POST" })
    .catch(() => null)
    .finally(() => {
      clearLocalRecord();
      existingDraft = null;
      form?.reset();
      seedDefaults();
      setMode("new");
    });
});

(async function init() {
  try {
    const session = await requestJson("/session", { method: "GET" });
    saveLocalRecord(session.record);
  } catch {
    // No active session; fall back to local draft.
  }

  existingDraft = await loadExistingRecord();
  if (existingDraft) {
    fillForm(existingDraft);
    setMode("edit");
    return;
  }
  seedDefaults();
  setMode("new");
})();
