// tldrman side panel: streaming SSE, markdown render, history, auto-run, shortcuts.

const DEFAULT_MODEL = "openrouter/free";
const MAX_CHARS = 12000;
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const HISTORY_LIMIT = 20;

const PROMPTS = {
  tldr: "Give a TLDR of the page below in 1-2 sentences. No preamble.",
  summary: "Summarize the page below in one short paragraph (3-6 sentences). Capture what it is about and why it matters.",
  bullets: "List the 5-8 key points from the page below as bullet lines starting with '- '. Be concise.",
  eli5: "Explain the page below like I'm 5 years old. Simple words, short sentences, one small paragraph plus one analogy.",
  takeaways: "From the page below, output two sections: 'Takeaways:' (3-5 bullets) then 'Next steps:' (1-3 short action items, or 'None' if not applicable).",
  shards: "You are building a technical knowledge shard for Obsidian from the page below. Output clean Markdown only, no preamble. Use exactly these sections:\n\n## Overview\n2-3 sentences: what this is and when to use it.\n\n## Key concepts\nBullet list of terms in bold with one-line definitions: - **Term** - definition.\n\n## How it works\nNumbered steps or short paragraphs explaining the mechanism.\n\n## Code / commands\nFenced code blocks with language tags where applicable. Skip if none.\n\n## Gotchas\nBullets: pitfalls, edge cases, version caveats.\n\n## References\nBullets with page links or named sources mentioned. Keep answers dense and technical.",
};
const MODE_SHORTCUTS = { tldr: "Alt+1", summary: "Alt+2", bullets: "Alt+3", eli5: "Alt+4", takeaways: "Alt+5", shards: "Alt+6" };

const statusEl = document.getElementById("status");
const outputEl = document.getElementById("output");
const usageEl = document.getElementById("usage");
const pageTitleEl = document.getElementById("pageTitle");
const pageInfoEl = document.getElementById("pageInfo");
const charCountEl = document.getElementById("charCount");
const readStateEl = document.getElementById("readState");
const keyWarningEl = document.getElementById("keyWarning");
const modelLabelEl = document.getElementById("modelLabel");
const modeLabelEl = document.getElementById("modeLabel");
const stopBtn = document.getElementById("stopBtn");
const buttons = [...document.querySelectorAll("button[data-mode]")];
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const autoRunEl = document.getElementById("autoRun");
const historyListEl = document.getElementById("historyList");
const historyCountEl = document.getElementById("historyCount");

let aborter = null;
let lastPage = null;
let lastMode = "summary";
let lastRaw = "";
let reading = false;

function setStatus(msg, busy = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("busy", busy);
}

function setBusy(busy) {
  buttons.forEach((b) => { b.disabled = busy; });
  stopBtn.disabled = !busy;
  chatForm.querySelector("button").disabled = busy;
  outputEl.classList.toggle("streaming", busy);
}

function markActiveMode(mode) {
  lastMode = mode;
  modeLabelEl.textContent = mode;
  buttons.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
}

async function getConfig() {
  const d = await chrome.storage.local.get(["apiKey", "model", "autoRun", "history"]);
  return {
    apiKey: d.apiKey || "",
    model: d.model || DEFAULT_MODEL,
    autoRun: Boolean(d.autoRun),
    history: Array.isArray(d.history) ? d.history : [],
  };
}

async function refreshConfigUI() {
  const { apiKey, model, autoRun } = await getConfig();
  keyWarningEl.hidden = Boolean(apiKey);
  modelLabelEl.textContent = "Model: " + model;
  autoRunEl.checked = autoRun;
}

// --- minimal markdown renderer (model output is escaped first) ---
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineMd(s) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

function renderMarkdown(raw) {
  const esc = escapeHtml(raw);
  const lines = esc.split("\n");
  let html = "";
  let inList = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^#{1,3}\s/.test(t)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += "<h3>" + inlineMd(t.replace(/^#{1,3}\s/, "")) + "</h3>";
    } else if (/^[-*]\s+/.test(t)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += "<li>" + inlineMd(t.replace(/^[-*]\s+/, "")) + "</li>";
    } else if (t === "") {
      if (inList) { html += "</ul>"; inList = false; }
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += "<p>" + inlineMd(t) + "</p>";
    }
  }
  if (inList) html += "</ul>";
  return html || '<p class="placeholder">Empty.</p>';
}

function showRaw(raw) {
  lastRaw = raw;
  outputEl.innerHTML = renderMarkdown(raw);
  outputEl.scrollTop = outputEl.scrollHeight;
}

// Serialized into the page: must stay self-contained (no closures).
// READ-ONLY on the live DOM: it works on a detached clone, so the page
// is never mutated (an earlier version called el.remove() on live nodes,
// which visibly broke pages: missing header/nav/footer and dead scripts).
function extractPageContent() {
  const title = document.title || "";
  const descMeta = document.querySelector('meta[name="description"]');
  const desc = (descMeta && descMeta.content) || "";
  const kill = "script,style,noscript,header,footer,nav,aside,.cookie,.cookies,.consent,.gdpr,.advert,.ads,.sidebar,.popup,.modal,.paywall";
  const candidates = ["article", "main", '[role="main"]', ".post-content", ".post", ".content", "#content"];
  let best = null;
  let bestLen = 0;
  // Read-only probing: innerText does not mutate the DOM.
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    const len = el && el.innerText ? el.innerText.trim().length : 0;
    if (len > bestLen && len > 500) { best = el; bestLen = len; }
  }
  let text = "";
  if (best) {
    // Narrow root (article/main) rarely contains boilerplate: read live text as-is.
    text = (best.innerText || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  } else {
    // Body fallback: strip boilerplate on a DETACHED clone only.
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll(kill).forEach((el) => el.remove());
    const parts = [];
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = (node.nodeValue || "").replace(/\s+/g, " ").trim();
      if (t && parts[parts.length - 1] !== t) parts.push(t);
    }
    text = parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  return { title, desc, text, url: location.href };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

function paintPage(page) {
  pageTitleEl.textContent = page.title || "Untitled page";
  pageInfoEl.textContent = page.url || "";
  pageInfoEl.title = page.url || "";
  charCountEl.textContent = page.text.length + " chars";
  readStateEl.textContent = "read";
}

async function readActiveTab() {
  const tab = await getActiveTab();
  if (!tab || tab.id == null) throw new Error("No active tab found.");
  if (!tab.url || /^(chrome|vivaldi|edge|about|chrome-extension|vivaldi):/.test(tab.url)) {
    throw new Error("Cannot read this page. Open a normal http(s) page.");
  }
  pageTitleEl.textContent = (tab.title || "Reading...").slice(0, 100);
  let res;
  try {
    [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPageContent });
  } catch (e) {
    throw new Error("Scripting blocked on this page. " + (e.message || e));
  }
  const data = res && res.result;
  if (!data || !data.text || data.text.trim().length < 50) throw new Error("No readable text found on this page.");
  lastPage = data;
  paintPage(data);
  return data;
}

function truncate(text) {
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "\n...[truncated]" : text;
}

function buildMessages(mode, page) {
  const header = "Title: " + page.title + "\nURL: " + page.url + (page.desc ? "\nDescription: " + page.desc : "");
  return [
    { role: "system", content: PROMPTS[mode] || PROMPTS.summary },
    { role: "user", content: header + "\n\nPage content:\n" + truncate(page.text) },
  ];
}

function buildChatMessages(question, page) {
  return [
    { role: "system", content: "Answer using ONLY the page content below. If missing, say so briefly. Under 120 words." },
    { role: "user", content: "Title: " + page.title + "\nURL: " + page.url + "\n\nPage content:\n" + truncate(page.text) + "\n\nQuestion: " + question },
  ];
}

function parseSSE(chunk) {
  const out = [];
  for (const part of chunk.split("\n\n")) {
    for (const line of part.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta;
        if (delta && delta.content) out.push(delta.content);
      } catch (e) { /* partial chunk */ }
    }
  }
  return out;
}

async function streamOpenRouter(apiKey, model, messages, signal) {
  const resp = await fetch(API_URL, {
    method: "POST", signal,
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json", "X-Title": "tldrman (local)" },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 1000 }),
  });
  if (!resp.ok) {
    let detail = "";
    try { detail = JSON.stringify(await resp.json()).slice(0, 300); } catch (e) { /* ignore */ }
    if (resp.status === 401) throw new Error("Invalid API key (401). Check Settings.");
    if (resp.status === 402) throw new Error("No free-model quota left (402). Retry later or pin another :free model.");
    if (resp.status === 429) throw new Error("Rate limited (429). Wait and retry.");
    throw new Error("OpenRouter error " + resp.status + ". " + detail);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const idx = buf.lastIndexOf("\n\n");
    if (idx === -1) continue;
    const processable = buf.slice(0, idx);
    buf = buf.slice(idx + 2);
    for (const t of parseSSE(processable)) { full += t; showRaw(full); }
  }
  if (buf.trim()) for (const t of parseSSE(buf)) { full += t; showRaw(full); }
  if (!full) throw new Error("Empty response from model.");
  return full;
}

async function saveHistory(entry) {
  const { history } = await getConfig();
  history.unshift(entry);
  await chrome.storage.local.set({ history: history.slice(0, HISTORY_LIMIT) });
  paintHistory(history.slice(0, HISTORY_LIMIT));
}

function paintHistory(history) {
  historyCountEl.textContent = String(history.length);
  if (!history.length) {
    historyListEl.innerHTML = '<p class="placeholder">No summaries yet.</p>';
    return;
  }
  historyListEl.innerHTML = "";
  history.forEach((h, i) => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.title = "Click to restore";
    const title = document.createElement("div");
    title.className = "h-title";
    title.textContent = (h.mode || "?") + ": " + (h.title || h.url || "page");
    const meta = document.createElement("div");
    meta.className = "h-meta";
    meta.textContent = new Date(h.ts).toLocaleString() + "  ·  " + (h.model || "");
    div.append(title, meta);
    div.addEventListener("click", () => {
      markActiveMode(h.mode || "summary");
      showRaw(h.text);
      setStatus("Restored from history.");
    });
    historyListEl.append(div);
    void i;
  });
}

async function run(mode) {
  if (aborter) aborter.abort();
  aborter = new AbortController();
  markActiveMode(mode);
  setBusy(true);
  setStatus("Reading active tab...", true);
  showRaw("");
  usageEl.textContent = "";
  try {
    const { apiKey, model } = await getConfig();
    if (!apiKey) { await refreshConfigUI(); throw new Error("Set your OpenRouter API key in Settings first."); }
    const page = await readActiveTab();
    setStatus("Streaming from " + model + "...", true);
    const full = await streamOpenRouter(apiKey, model, buildMessages(mode, page), aborter.signal);
    setStatus("Done. " + page.text.length + " chars read.");
    await saveHistory({ ts: Date.now(), mode, title: page.title, url: page.url, model, text: full });
  } catch (e) {
    setStatus(e.name === "AbortError" ? "Stopped." : "Error: " + (e.message || e));
  } finally {
    aborter = null;
    setBusy(false);
  }
}

async function ask(question) {
  if (aborter) aborter.abort();
  aborter = new AbortController();
  setBusy(true);
  markActiveMode("ask");
  showRaw("");
  try {
    const { apiKey, model } = await getConfig();
    if (!apiKey) throw new Error("Set your OpenRouter API key in Settings first.");
    const page = lastPage || await readActiveTab();
    setStatus("Asking about this page...", true);
    await streamOpenRouter(apiKey, model, buildChatMessages(question, page), aborter.signal);
    setStatus("Done.");
  } catch (e) {
    setStatus(e.name === "AbortError" ? "Stopped." : "Error: " + (e.message || e));
  } finally {
    aborter = null;
    setBusy(false);
  }
}

buttons.forEach((b) => b.addEventListener("click", () => run(b.dataset.mode)));
stopBtn.addEventListener("click", () => { if (aborter) aborter.abort(); });
document.getElementById("refreshBtn").addEventListener("click", async () => {
  try {
    const page = await readActiveTab();
    setStatus("Page re-read: " + page.text.length + " chars cached.");
  } catch (e) {
    setStatus("Error: " + (e.message || e));
  }
});
document.getElementById("copyBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lastRaw);
    setStatus(lastRaw ? "Copied to clipboard." : "Nothing to copy yet.");
  } catch (e) {
    setStatus("Copy failed: " + (e.message || e));
  }
});
function slugify(s) {
  return (s || "shard").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "shard";
}

function buildObsidianMarkdown() {
  const page = lastPage || {};
  const title = (page.title || "Untitled").replace(/"/g, "'");
  const date = new Date().toISOString().slice(0, 10);
  const front = "---\ntitle: \"" + title + "\"\nsource: " + (page.url || "") + "\ncreated: " + date + "\nmodel: " + modeLabelEl.textContent + "\ntags: [tldrman, knowledge-shard]\n---\n\n";
  return front + "# " + title + "\n\n" + lastRaw.trim() + "\n\n---\nSource: " + (page.url || "") + "\n";
}

document.getElementById("exportBtn").addEventListener("click", () => {
  if (!lastRaw.trim()) { setStatus("Nothing to export yet."); return; }
  const page = lastPage || {};
  const name = new Date().toISOString().slice(0, 10) + "-" + slugify(page.title) + ".md";
  const blob = new Blob([buildObsidianMarkdown()], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  setStatus("Exported " + name + " - move it into your Obsidian vault.");
});
document.getElementById("clearBtn").addEventListener("click", () => {
  showRaw("");
  setStatus("Cleared.");
});
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = chatInput.value.trim();
  if (q) ask(q);
});
autoRunEl.addEventListener("change", async () => {
  await chrome.storage.local.set({ autoRun: autoRunEl.checked });
  setStatus(autoRunEl.checked ? "Auto-summarize on page load: on." : "Auto-summarize: off.");
});

// Keyboard: Alt+1..5 modes, Esc stop, / focuses chat.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && aborter) { aborter.abort(); return; }
  if (e.key === "/" && document.activeElement !== chatInput) { e.preventDefault(); chatInput.focus(); return; }
  if (!e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) return;
  const modes = ["tldr", "summary", "bullets", "eli5", "takeaways", "shards"];
  const idx = ["1", "2", "3", "4", "5", "6"].indexOf(e.key);
  if (idx !== -1) { e.preventDefault(); run(modes[idx]); }
});

// Tab tracking: refresh label, clear stale cache, optional auto-run.
let debounce = null;
async function onTabChange(auto = false) {
  if (reading) return;
  reading = true;
  try {
    const tab = await getActiveTab();
    lastPage = null;
    readStateEl.textContent = "not read";
    if (tab && tab.url && /^https?/.test(tab.url)) {
      pageTitleEl.textContent = (tab.title || "New page").slice(0, 100);
      pageInfoEl.textContent = tab.url.slice(0, 140);
      charCountEl.textContent = "— chars";
      if (auto) {
        const { autoRun, apiKey } = await getConfig();
        if (autoRun && apiKey) { reading = false; run(lastMode); return; }
      }
    }
  } catch (e) { /* ignore */ }
  reading = false;
}
chrome.tabs.onActivated.addListener(() => {
  clearTimeout(debounce);
  debounce = setTimeout(() => onTabChange(true), 400);
});
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "complete") {
    clearTimeout(debounce);
    debounce = setTimeout(() => onTabChange(true), 600);
  }
});

chrome.storage.onChanged.addListener(() => refreshConfigUI());
(async function init() {
  await refreshConfigUI();
  const { history } = await getConfig();
  paintHistory(history);
  markActiveMode("summary");
  onTabChange(false);
})();
