// tldrman side panel: streaming SSE, markdown render, history, auto-run, shortcuts.

const DEFAULT_MODEL = "openrouter/free";
const DEFAULT_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_LANGUAGE = (typeof TLDRMAN_DEFAULT_LANGUAGE !== "undefined") ? TLDRMAN_DEFAULT_LANGUAGE : "en";
const MAX_CHARS = 12000;

// Any OpenAI-compatible provider works: base URL + /chat/completions.
// OpenRouter stays the default fallback.
function normalizeBase(u) {
  return (u || DEFAULT_BASE).trim().replace(/\/+$/, "");
}

function isLocalProvider(base) {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])|[a-z0-9-]+\.local)/i.test(base);
}

function shortHost(base) {
  try { return new URL(base).hostname; } catch (e) { return base; }
}
const HISTORY_LIMIT = 20;

const PROMPTS = {
  tldr: "Give a TLDR of the page below in 1-2 sentences. No preamble.",
  summary: "Summarize the page below in one short paragraph (3-6 sentences). Capture what it is about and why it matters.",
  bullets: "List the 5-8 key points from the page below as bullet lines starting with '- '. Be concise.",
  eli5: "Explain the page below like I'm 5 years old. Simple words, short sentences, one small paragraph plus one analogy.",
  takeaways: "From the page below, output two sections: 'Takeaways:' (3-5 bullets) then 'Next steps:' (1-3 short action items, or 'None' if not applicable).",
  shards: "You are building a technical knowledge shard for Obsidian from the page below. Output clean Markdown only, no preamble. Use exactly these sections:\n\n## Overview\n2-3 sentences: what this is and when to use it.\n\n## Key concepts\nBullet list of terms in bold with one-line definitions: - **Term** - definition.\n\n## How it works\nNumbered steps or short paragraphs explaining the mechanism.\n\n## Code / commands\nFenced code blocks with language tags where applicable. Skip if none.\n\n## Gotchas\nBullets: pitfalls, edge cases, version caveats.\n\n## References\nBullets with page links or named sources mentioned. Keep answers dense and technical.",
  post: "Turn the page below into ONE share-ready social post. Output plain text only, exactly this shape:\n\n[HOOK - one punchy line under 120 characters]\n\n[2-4 short lines with the most surprising or useful point. Line breaks between ideas. No jargon. Under 400 characters total.]\n\n[3-5 hashtags on one line]\n\n[One-line CTA: comment, share or follow]\nKeep it self-contained: no 'this article' phrasing, state the idea directly.",
  thread: "Turn the page below into an X thread of exactly 5 posts. Output plain text only. Number them '1/5' to '5/5'. Each post MUST be under 260 characters including the number. Rules: 1/5 is a standalone hook (works without context), 2-4 deliver one idea each with zero fluff, 5/5 is the takeaway plus a CTA (follow/repost). No hashtags except one max in 5/5. No 'this article' phrasing.",
  reel: "Turn the page below into a 30-45 second Instagram reel script (max ~110 spoken words). Output Markdown with exactly this shape:\n\n## Titles\n3 options, each under 60 characters.\n\n## Hook (0:00-0:03)\n**Say:** one spoken line under 20 words.\n**Show:** on-screen text under 8 words.\n\n## Beats\n3 beats. Each beat:\n**Say:** 1-2 spoken lines.\n**Show:** on-screen text and one B-roll/cut suggestion.\n\n## CTA (final 3s)\n**Say:** one line (follow / link in bio / comment).\n**Show:** on-screen text.\n\nRules: spoken lines use simple everyday words, readable aloud. One idea per beat. No hashtags in script; add one line of 3-5 hashtags at the very end under '## Hashtags'.",
};
const MODE_SHORTCUTS = { tldr: "Alt+1", summary: "Alt+2", bullets: "Alt+3", eli5: "Alt+4", takeaways: "Alt+5", shards: "Alt+6", post: "Alt+7", thread: "Alt+8", reel: "Alt+9" };

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
let uiLang = "en";
let uiLangStored = "browser";

function t(key, params) {
  if (typeof tldrmanT === "function") return tldrmanT(uiLang, key, params);
  return key;
}

function applyUiLanguage(stored) {
  uiLangStored = stored || "browser";
  uiLang = (typeof tldrmanResolveUiLanguage === "function") ? tldrmanResolveUiLanguage(uiLangStored) : "en";
  if (typeof tldrmanApplyStatic === "function") tldrmanApplyStatic(document, uiLang);
  paintStaticDynamic();
}

function paintStaticDynamic() {
  if (!lastRaw && outputEl) {
    outputEl.innerHTML = '<p class="placeholder">' + escapeHtml(t("sp.resultsPlaceholder")) + "</p>";
  }
  if (statusEl && !statusEl.dataset.touched && !statusEl.classList.contains("busy")) {
    statusEl.textContent = t("sp.clickSummarize");
  }
  if (readStateEl && !lastPage) {
    readStateEl.textContent = t("sp.notRead");
  }
  if (!lastPage) {
    if (pageTitleEl && !pageTitleEl.dataset.touched) pageTitleEl.textContent = t("sp.noPage");
    if (pageInfoEl && !pageInfoEl.dataset.touched) pageInfoEl.textContent = t("sp.openPage");
  }
}

function setStatus(msg, busy = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle("busy", busy);
  statusEl.dataset.touched = "1";
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
  const d = await chrome.storage.local.get(["apiKey", "model", "baseUrl", "autoRun", "history", "language", "uiLanguage"]);
  const baseUrl = normalizeBase(d.baseUrl || DEFAULT_BASE);
  return {
    apiKey: d.apiKey || "",
    model: d.model || DEFAULT_MODEL,
    baseUrl,
    language: d.language || DEFAULT_LANGUAGE,
    uiLanguage: d.uiLanguage || "browser",
    needsKey: !isLocalProvider(baseUrl) && !(d.apiKey || ""),
    autoRun: Boolean(d.autoRun),
    history: Array.isArray(d.history) ? d.history : [],
  };
}

function languageLabel(code) {
  if (typeof tldrmanLanguageLabel === "function") return tldrmanLanguageLabel(code);
  return code || DEFAULT_LANGUAGE;
}

function languageInstruction(code) {
  if (typeof tldrmanLanguageInstruction === "function") return tldrmanLanguageInstruction(code);
  return "Respond entirely in English.";
}

async function refreshConfigUI() {
  const { apiKey, model, baseUrl, autoRun, language, uiLanguage } = await getConfig();
  const resolved = (typeof tldrmanResolveUiLanguage === "function") ? tldrmanResolveUiLanguage(uiLanguage) : "en";
  if (uiLanguage !== uiLangStored || resolved !== uiLang) applyUiLanguage(uiLanguage);
  keyWarningEl.hidden = Boolean(apiKey) || isLocalProvider(baseUrl);
  modelLabelEl.textContent = shortHost(baseUrl) + " / " + model + " · " + languageLabel(language);
  modelLabelEl.title = baseUrl + "  model=" + model + "  language=" + (language || DEFAULT_LANGUAGE);
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
  return html || '<p class="placeholder">' + escapeHtml(t("sp.empty")) + "</p>";
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
  pageTitleEl.textContent = page.title || t("sp.untitled");
  pageTitleEl.dataset.touched = "1";
  pageInfoEl.textContent = page.url || "";
  pageInfoEl.title = page.url || "";
  pageInfoEl.dataset.touched = "1";
  charCountEl.textContent = t("sp.chars", { n: page.text.length });
  readStateEl.textContent = t("sp.read");
}

async function readActiveTab() {
  const tab = await getActiveTab();
  if (!tab || tab.id == null) throw new Error(t("st.noTab"));
  if (!tab.url || /^(chrome|vivaldi|edge|about|chrome-extension|vivaldi):/.test(tab.url)) {
    throw new Error(t("st.cannotRead"));
  }
  pageTitleEl.textContent = (tab.title || t("st.reading")).slice(0, 100);
  pageTitleEl.dataset.touched = "1";
  let res;
  try {
    [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractPageContent });
  } catch (e) {
    throw new Error(t("st.scriptBlocked", { msg: (e.message || e) }));
  }
  const data = res && res.result;
  if (!data || !data.text || data.text.trim().length < 50) throw new Error(t("st.noText"));
  lastPage = data;
  paintPage(data);
  return data;
}

function truncate(text) {
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "\n...[truncated]" : text;
}

function buildMessages(mode, page, language) {
  const header = "Title: " + page.title + "\nURL: " + page.url + (page.desc ? "\nDescription: " + page.desc : "");
  const system = (PROMPTS[mode] || PROMPTS.summary) + "\n\n" + languageInstruction(language || DEFAULT_LANGUAGE);
  return [
    { role: "system", content: system },
    { role: "user", content: header + "\n\nPage content:\n" + truncate(page.text) },
  ];
}

function buildChatMessages(question, page, language) {
  const system = "Answer using ONLY the page content below. If missing, say so briefly. Under 120 words. " + languageInstruction(language || DEFAULT_LANGUAGE);
  return [
    { role: "system", content: system },
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

async function streamChat(baseUrl, apiKey, model, messages, signal) {
  const isOpenRouter = baseUrl.includes("openrouter.ai");
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = "Bearer " + apiKey;
  if (isOpenRouter) headers["X-Title"] = "tldrman (local)";
  const resp = await fetch(baseUrl + "/chat/completions", {
    method: "POST", signal, headers,
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 1000 }),
  });
  if (!resp.ok) {
    let detail = "";
    try { detail = JSON.stringify(await resp.json()).slice(0, 300); } catch (e) { /* ignore */ }
    if (resp.status === 401) throw new Error(t("st.invalidKey"));
    if (resp.status === 402 && isOpenRouter) throw new Error(t("st.noQuota"));
    if (resp.status === 402) throw new Error(t("st.payment", { detail }));
    if (resp.status === 429) throw new Error(t("st.rateLimited"));
    if (resp.status === 404) throw new Error(t("st.notFound", { detail }));
    throw new Error(t("st.providerError", { status: resp.status, host: shortHost(baseUrl), detail }));
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
    for (const tok of parseSSE(processable)) { full += tok; showRaw(full); }
  }
  if (buf.trim()) for (const tok of parseSSE(buf)) { full += tok; showRaw(full); }
  if (!full) throw new Error(t("st.emptyResp"));
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
    historyListEl.innerHTML = '<p class="placeholder">' + escapeHtml(t("sp.noHistory")) + "</p>";
    return;
  }
  historyListEl.innerHTML = "";
  history.forEach((h, i) => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.title = t("sp.clickRestore");
    const title = document.createElement("div");
    title.className = "h-title";
    title.textContent = (h.mode || "?") + ": " + (h.title || h.url || "page");
    const meta = document.createElement("div");
    meta.className = "h-meta";
    meta.textContent = new Date(h.ts).toLocaleString() + "  ·  " + (h.model || "") + (h.language ? "  ·  " + languageLabel(h.language) : "");
    div.append(title, meta);
    div.addEventListener("click", () => {
      markActiveMode(h.mode || "summary");
      showRaw(h.text);
      setStatus(t("st.restored"));
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
  setStatus(t("st.reading"), true);
  showRaw("");
  usageEl.textContent = "";
  try {
    const { apiKey, model, baseUrl, needsKey, language } = await getConfig();
    if (needsKey) { await refreshConfigUI(); throw new Error(t("st.needKey")); }
    const page = await readActiveTab();
    setStatus(t("st.streamingFrom", { model }), true);
    const full = await streamChat(baseUrl, apiKey, model, buildMessages(mode, page, language), aborter.signal);
    setStatus(t("st.doneChars", { n: page.text.length }));
    await saveHistory({ ts: Date.now(), mode, title: page.title, url: page.url, model, language, text: full });
  } catch (e) {
    setStatus(e.name === "AbortError" ? t("st.stopped") : t("st.error", { msg: (e.message || e) }));
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
    const { apiKey, model, baseUrl, needsKey, language } = await getConfig();
    if (needsKey) throw new Error(t("st.needKey"));
    const page = lastPage || await readActiveTab();
    setStatus(t("st.asking"), true);
    await streamChat(baseUrl, apiKey, model, buildChatMessages(question, page, language), aborter.signal);
    setStatus(t("st.done"));
  } catch (e) {
    setStatus(e.name === "AbortError" ? t("st.stopped") : t("st.error", { msg: (e.message || e) }));
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
    setStatus(t("st.reread", { n: page.text.length }));
  } catch (e) {
    setStatus(t("st.error", { msg: (e.message || e) }));
  }
});
document.getElementById("copyBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lastRaw);
    setStatus(lastRaw ? t("st.copied") : t("st.nothingCopy"));
  } catch (e) {
    setStatus(t("st.copyFailed", { msg: (e.message || e) }));
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
  if (!lastRaw.trim()) { setStatus(t("st.nothingExport")); return; }
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
  setStatus(t("st.exported", { name }));
});
document.getElementById("clearBtn").addEventListener("click", () => {
  showRaw("");
  setStatus(t("st.cleared"));
});
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = chatInput.value.trim();
  if (q) ask(q);
});
autoRunEl.addEventListener("change", async () => {
  await chrome.storage.local.set({ autoRun: autoRunEl.checked });
  setStatus(autoRunEl.checked ? t("st.autoOn") : t("st.autoOff"));
});

// Keyboard: Alt+1..5 modes, Esc stop, / focuses chat.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && aborter) { aborter.abort(); return; }
  if (e.key === "/" && document.activeElement !== chatInput) { e.preventDefault(); chatInput.focus(); return; }
  if (!e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) return;
  const modes = ["tldr", "summary", "bullets", "eli5", "takeaways", "shards", "post", "thread", "reel"];
  const idx = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].indexOf(e.key);
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
    readStateEl.textContent = t("sp.notRead");
    if (tab && tab.url && /^https?/.test(tab.url)) {
      pageTitleEl.textContent = (tab.title || t("sp.untitled")).slice(0, 100);
      pageTitleEl.dataset.touched = "1";
      pageInfoEl.textContent = tab.url.slice(0, 140);
      pageInfoEl.dataset.touched = "1";
      charCountEl.textContent = "—";
      if (auto) {
        const { autoRun, needsKey } = await getConfig();
        if (autoRun && !needsKey) { reading = false; run(lastMode); return; }
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
  const { uiLanguage, history } = await getConfig();
  applyUiLanguage(uiLanguage);
  await refreshConfigUI();
  paintHistory(history);
  markActiveMode("summary");
  onTabChange(false);
})();
