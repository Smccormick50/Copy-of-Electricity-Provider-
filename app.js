/*
  McCoy's Electrical Provider Search
  1) Deploy Code.gs as a Google Apps Script web app.
  2) Paste the deployed URL below.
  3) Upload this folder to GitHub Pages or your web host.
*/

const CONFIG = {
  // Example format: https://script.google.com/macros/s/AKfycbx.../exec
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwNRho2lENbJSVbmjeQ7azLC2ojYicQJ-hYhXGjpnbbJRmF1P92F6nTcbcpQ6YuemjW/exec",
  SHEET_EDIT_URL: "https://docs.google.com/spreadsheets/d/1pVbdn5lAn42CXMBxAtBdOre2DqlgkLEqQ2aQ8g83b7E/edit?usp=sharing",
  LOCAL_CACHE_KEY: "mccoys-electrical-provider-list-v6"
};

const FIELD_ALIASES = {
  store: [
    "store", "store #", "store#", "store number", "store no", "store no.", "store num", "store id", "location", "location #", "location number", "st", "st #", "st#", "number", "#"
  ],
  provider: [
    "electrical provider", "electric provider", "electricity provider", "provider", "utility provider", "rep", "retail electric provider"
  ],
  delivery: [
    "delivery co.", "delivery co", "delivery company", "tdsp", "tdsp name", "tdu", "utility", "utility company", "transmission delivery utility"
  ],
  esid: [
    "esid", "esi id", "esiid", "esi id #", "esid#", "esid #", "meter esid", "service id"
  ],
  account: [
    "account", "account #", "account#", "account number", "acct", "acct #", "account no", "account no."
  ],
  esidAccount: [
    "esid#/account#", "esid #/account #", "esid/account", "esid/account#", "esid / account", "esid / account #", "esid account"
  ],
  outage: [
    "outage phone #", "outage phone", "outage number", "outage", "outage phone number", "power outage", "emergency phone", "phone"
  ],
  address: ["address", "store address", "service address"],
  city: ["city"],
  state: ["state", "st"],
  notes: ["notes", "comments", "comment"]
};

let allRows = [];
let headerMap = new Map();
let lastSourceSummary = "";

const $ = (id) => document.getElementById(id);
const searchInput = $("storeSearch");
const resultsEl = $("results");
const dataStatus = $("dataStatus");
const setupNotice = $("setupNotice");

init();

function init() {
  $("sheetLink").href = CONFIG.SHEET_EDIT_URL;
  $("clearBtn").addEventListener("click", () => {
    searchInput.value = "";
    searchInput.focus();
    renderResults();
  });
  $("refreshBtn").addEventListener("click", () => loadData(true));
  searchInput.addEventListener("input", renderResults);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }

  loadData(false);
}

async function loadData(forceRefresh) {
  const hasUrl = CONFIG.APPS_SCRIPT_URL && !CONFIG.APPS_SCRIPT_URL.includes("PASTE_YOUR");
  setupNotice.classList.toggle("hidden", hasUrl);

  if (!forceRefresh) {
    const cached = readCache();
    if (cached.length) {
      setRows(cached);
      dataStatus.textContent = `${cached.length} stores loaded from phone cache`;
    }
  }

  if (!hasUrl) {
    if (!allRows.length) {
      dataStatus.textContent = "Waiting for Google Apps Script URL";
      renderEmpty("After setup, your store list will load here.");
    }
    return;
  }

  try {
    dataStatus.textContent = "Refreshing provider list...";
    const payload = await fetchJsonp(CONFIG.APPS_SCRIPT_URL, { action: "list" });
    if (!payload || payload.ok !== true || !Array.isArray(payload.data)) {
      throw new Error(payload && payload.error ? payload.error : "The spreadsheet response was not valid.");
    }
    lastSourceSummary = buildSourceSummary(payload);
    setRows(payload.data);
    writeCache(payload.data);
    const updated = payload.updatedAt ? ` • updated ${new Date(payload.updatedAt).toLocaleString()}` : "";
    const sourceText = lastSourceSummary ? ` • source: ${lastSourceSummary}` : "";
    dataStatus.textContent = `${payload.data.length} stores loaded${sourceText}${updated}`;
    renderResults();
  } catch (error) {
    console.error(error);
    const detail = error && error.message ? error.message : "Unknown error";
    if (allRows.length) {
      dataStatus.textContent = `Using saved phone cache. Refresh failed: ${detail}`;
      renderResults();
    } else {
      dataStatus.textContent = `Provider list could not load: ${detail}`;
      renderEmpty("Google Apps Script is not returning the sheet data yet. Check Code.gs, deploy a new version, then tap Refresh.");
    }
  }
}

function buildSourceSummary(payload) {
  if (!payload) return "";
  if (Array.isArray(payload.usedSheetTabs) && payload.usedSheetTabs.length) {
    return payload.usedSheetTabs.join(", ");
  }
  if (Array.isArray(payload.usedSheets) && payload.usedSheets.length) {
    return payload.usedSheets.join(", ");
  }
  if (payload.spreadsheetName) return payload.spreadsheetName;
  return "";
}

function setRows(rows) {
  allRows = rows.filter(row => row && typeof row === "object");
  headerMap = buildHeaderMap(allRows);
  renderResults();
}

function buildHeaderMap(rows) {
  const map = new Map();
  const headers = new Set();
  rows.forEach(row => Object.keys(row).forEach(key => headers.add(key)));
  for (const key of headers) map.set(normalizeHeader(key), key);
  return map;
}

function getValue(row, fieldName) {
  const aliases = FIELD_ALIASES[fieldName] || [];
  for (const alias of aliases) {
    const actualHeader = headerMap.get(normalizeHeader(alias));
    if (actualHeader && row[actualHeader] !== undefined && String(row[actualHeader]).trim() !== "") {
      return String(row[actualHeader]).trim();
    }
  }
  return "";
}

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[#.:()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeStoreLookup(value) {
  const cleaned = normalizeSearch(value);
  if (!cleaned) return "";

  // Store numbers are sometimes saved in the spreadsheet as 55, while users type 055.
  // This makes 055, 55, and 00055 match the same store.
  if (/^\d+$/.test(cleaned)) {
    return String(parseInt(cleaned, 10));
  }

  return cleaned;
}

function renderResults() {
  const rawQuery = searchInput.value.trim();
  const query = normalizeStoreLookup(rawQuery);
  const displayQuery = rawQuery || searchInput.value;
  if (!query) {
    renderEmpty(allRows.length ? "Enter a store number to search." : "No provider data loaded yet.");
    return;
  }

  const exact = [];
  const partial = [];

  for (const row of allRows) {
    const storeRaw = getValue(row, "store");
    const store = normalizeStoreLookup(storeRaw);
    const storeSearch = normalizeSearch(storeRaw);
    const querySearch = normalizeSearch(rawQuery);

    if (!store && !storeSearch) continue;

    if (store === query || storeSearch === querySearch) {
      exact.push(row);
    } else if (store.includes(query) || storeSearch.includes(querySearch)) {
      partial.push(row);
    }
  }

  const matches = exact.length ? exact : partial.slice(0, 12);
  if (!matches.length) {
    const sourceNote = lastSourceSummary ? `<br><small>Loaded from tab(s): ${escapeHtml(lastSourceSummary)}</small>` : "";
    renderEmpty(`No store found for “${displayQuery}”.${sourceNote}`, true);
    return;
  }

  resultsEl.innerHTML = "";
  matches.forEach(row => resultsEl.appendChild(createResultCard(row, exact.length ? "Exact match" : "Possible match")));
}

function renderEmpty(message, allowHtml = false) {
  resultsEl.innerHTML = `<div class="empty-state">${allowHtml ? message : escapeHtml(message)}</div>`;
}

function createResultCard(row, badgeText) {
  const template = $("cardTemplate");
  const card = template.content.firstElementChild.cloneNode(true);
  const store = getValue(row, "store") || "Unknown";
  card.querySelector(".store-number").textContent = store;
  card.querySelector(".match-badge").textContent = badgeText;

  const esidAccount = getValue(row, "esidAccount");
  const fields = [
    ["Electrical Provider", getValue(row, "provider")],
    ["Delivery Co.", getValue(row, "delivery")],
    ["ESID #", getValue(row, "esid") || esidAccount],
    ["Account #", getValue(row, "account") || (!getValue(row, "esid") ? "" : esidAccount)],
    ["Outage Phone #", getValue(row, "outage")],
    ["Address", formatAddress(row)],
    ["Notes", getValue(row, "notes")]
  ].filter(([, value]) => value);

  const grid = card.querySelector(".info-grid");
  for (const [label, value] of fields) {
    const item = document.createElement("div");
    item.className = "info-item";

    const dt = document.createElement("dt");
    dt.textContent = label;

    const dd = document.createElement("dd");
    if (label === "Outage Phone #") {
      const phoneLink = document.createElement("a");
      phoneLink.className = "phone-link";
      phoneLink.href = phoneToTel(value);
      phoneLink.textContent = value;
      phoneLink.setAttribute("aria-label", `Call outage number ${value}`);
      dd.appendChild(phoneLink);
    } else {
      dd.textContent = value;
    }

    item.appendChild(dt);
    item.appendChild(dd);
    grid.appendChild(item);
  }

  const actions = card.querySelector(".card-actions");
  const outagePhone = getValue(row, "outage");
  if (outagePhone) {
    const phoneLink = document.createElement("a");
    phoneLink.href = phoneToTel(outagePhone);
    phoneLink.textContent = "Call outage number";
    phoneLink.setAttribute("aria-label", `Call outage number ${outagePhone}`);
    actions.appendChild(phoneLink);
  }

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "copy-btn";
  copyBtn.textContent = "Copy info";
  copyBtn.addEventListener("click", async () => {
    const text = buildCopyText(row);
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied";
      setTimeout(() => copyBtn.textContent = "Copy info", 1400);
    } catch {
      window.prompt("Copy this info:", text);
    }
  });
  actions.appendChild(copyBtn);

  if (!fields.length) {
    grid.innerHTML = `<div class="empty-state">This row loaded, but the column names do not match the app fields yet.</div>`;
  }

  return card;
}

function phoneToTel(value) {
  const cleaned = String(value || "").replace(/[^+0-9]/g, "");
  return cleaned ? `tel:${cleaned}` : "#";
}

function formatAddress(row) {
  const address = getValue(row, "address");
  const city = getValue(row, "city");
  const state = getValue(row, "state");
  return [address, [city, state].filter(Boolean).join(", ")].filter(Boolean).join(" • ");
}

function buildCopyText(row) {
  return [
    `Store: ${getValue(row, "store")}`,
    `Electrical Provider: ${getValue(row, "provider")}`,
    `Delivery Co.: ${getValue(row, "delivery")}`,
    `ESID #: ${getValue(row, "esid") || getValue(row, "esidAccount")}`,
    `Account #: ${getValue(row, "account")}`,
    `Outage Phone #: ${getValue(row, "outage")}`,
    formatAddress(row) ? `Address: ${formatAddress(row)}` : "",
    getValue(row, "notes") ? `Notes: ${getValue(row, "notes")}` : ""
  ].filter(Boolean).join("\n");
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CONFIG.LOCAL_CACHE_KEY) || "[]"); }
  catch { return []; }
}

function writeCache(rows) {
  try { localStorage.setItem(CONFIG.LOCAL_CACHE_KEY, JSON.stringify(rows)); }
  catch {}
}

function fetchJsonp(baseUrl, params = {}) {
  return new Promise((resolve, reject) => {
    const callback = `mccoysProviderCallback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    url.searchParams.set("callback", callback);
    url.searchParams.set("_", Date.now());

    const script = document.createElement("script");
    const timeout = window.setTimeout(() => cleanup(new Error("Request timed out.")), 18000);

    window[callback] = (data) => cleanup(null, data);
    script.onerror = () => cleanup(new Error("Could not reach Google Apps Script."));

    function cleanup(error, data) {
      window.clearTimeout(timeout);
      delete window[callback];
      script.remove();
      error ? reject(error) : resolve(data);
    }

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
