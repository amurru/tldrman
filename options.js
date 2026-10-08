const PRESETS = {
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "openrouter/free" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  ollama: { baseUrl: "http://localhost:11434/v1", model: "llama3.1" },
  lmstudio: { baseUrl: "http://localhost:1234/v1", model: "local-model" },
};

const presetEl = document.getElementById("preset");
const baseUrlEl = document.getElementById("baseUrl");
const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const languageEl = document.getElementById("language");
const uiLanguageEl = document.getElementById("uiLanguage");
const statusEl = document.getElementById("status");

const DEFAULT_LANGUAGE = (typeof TLDRMAN_DEFAULT_LANGUAGE !== "undefined") ? TLDRMAN_DEFAULT_LANGUAGE : "en";
const LANGUAGES = (typeof TLDRMAN_LANGUAGES !== "undefined") ? TLDRMAN_LANGUAGES : [{ code: "en", label: "English", group: "General" }];
const UI_LANG_CODES = (typeof TLDRMAN_UI_LANG_CODES !== "undefined") ? TLDRMAN_UI_LANG_CODES : ["en"];
const UI_AUTONYMS = (typeof TLDRMAN_UI_AUTONYMS !== "undefined") ? TLDRMAN_UI_AUTONYMS : { en: "English" };

let uiLang = "en";

function t(key, params) {
  if (typeof tldrmanT === "function") return tldrmanT(uiLang, key, params);
  return key;
}

function applyUiLanguage(stored) {
  uiLang = (typeof tldrmanResolveUiLanguage === "function") ? tldrmanResolveUiLanguage(stored) : "en";
  if (typeof tldrmanApplyStatic === "function") tldrmanApplyStatic(document, uiLang);
  buildUiLanguageOptions(stored || "browser");
}

function buildUiLanguageOptions(stored) {
  uiLanguageEl.innerHTML = "";
  const browserOpt = document.createElement("option");
  browserOpt.value = "browser";
  browserOpt.textContent = t("opt.uiBrowserDefault") + " (" + browserUiPreview() + ")";
  uiLanguageEl.append(browserOpt);
  for (const code of UI_LANG_CODES) {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = UI_AUTONYMS[code] || code;
    uiLanguageEl.append(opt);
  }
  uiLanguageEl.value = stored || "browser";
  if (![...uiLanguageEl.options].some((o) => o.value === uiLanguageEl.value)) {
    uiLanguageEl.value = "browser";
  }
}

function browserUiPreview() {
  if (typeof tldrmanMapBrowserToUi === "function" && typeof tldrmanBrowserUiLanguage === "function") {
    const resolved = tldrmanMapBrowserToUi(tldrmanBrowserUiLanguage());
    return UI_AUTONYMS[resolved] || resolved;
  }
  return "English";
}

function buildLanguageOptions() {
  languageEl.innerHTML = "";
  const groups = {};
  for (const lang of LANGUAGES) {
    const g = lang.group || "Other";
    if (!groups[g]) {
      groups[g] = document.createElement("optgroup");
      groups[g].label = g;
      languageEl.append(groups[g]);
    }
    const opt = document.createElement("option");
    opt.value = lang.code;
    opt.textContent = lang.label;
    groups[g].append(opt);
  }
}

function guessPreset(baseUrl) {
  for (const [name, p] of Object.entries(PRESETS)) {
    if (p.baseUrl === (baseUrl || "").trim()) return name;
  }
  return "custom";
}

async function load() {
  const d = await chrome.storage.local.get(["apiKey", "model", "baseUrl", "language", "uiLanguage"]);
  baseUrlEl.value = d.baseUrl || PRESETS.openrouter.baseUrl;
  apiKeyEl.value = d.apiKey || "";
  modelEl.value = d.model || PRESETS.openrouter.model;
  presetEl.value = guessPreset(baseUrlEl.value);
  applyUiLanguage(d.uiLanguage || "browser");
  buildLanguageOptions();
  languageEl.value = d.language || DEFAULT_LANGUAGE;
  if (![...languageEl.options].some((o) => o.value === languageEl.value)) {
    languageEl.value = DEFAULT_LANGUAGE;
  }
}

presetEl.addEventListener("change", () => {
  const p = PRESETS[presetEl.value];
  if (!p) return; // custom: leave fields alone
  baseUrlEl.value = p.baseUrl;
  if (!modelEl.value || Object.values(PRESETS).some((x) => x.model === modelEl.value)) {
    modelEl.value = p.model;
  }
});

uiLanguageEl.addEventListener("change", () => {
  applyUiLanguage(uiLanguageEl.value || "browser");
});

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    baseUrl: baseUrlEl.value.trim().replace(/\/+$/, "") || PRESETS.openrouter.baseUrl,
    apiKey: apiKeyEl.value.trim(),
    model: modelEl.value.trim() || PRESETS.openrouter.model,
    language: languageEl.value || DEFAULT_LANGUAGE,
    uiLanguage: uiLanguageEl.value || "browser",
  });
  applyUiLanguage(uiLanguageEl.value || "browser");
  statusEl.textContent = t("opt.saved");
  setTimeout(() => { statusEl.textContent = ""; }, 1500);
});

load();
