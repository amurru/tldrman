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
const statusEl = document.getElementById("status");

const DEFAULT_LANGUAGE = (typeof TLDRMAN_DEFAULT_LANGUAGE !== "undefined") ? TLDRMAN_DEFAULT_LANGUAGE : "en";
const LANGUAGES = (typeof TLDRMAN_LANGUAGES !== "undefined") ? TLDRMAN_LANGUAGES : [{ code: "en", label: "English", group: "General" }];

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
  const d = await chrome.storage.local.get(["apiKey", "model", "baseUrl", "language"]);
  baseUrlEl.value = d.baseUrl || PRESETS.openrouter.baseUrl;
  apiKeyEl.value = d.apiKey || "";
  modelEl.value = d.model || PRESETS.openrouter.model;
  presetEl.value = guessPreset(baseUrlEl.value);
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

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    baseUrl: baseUrlEl.value.trim().replace(/\/+$/, "") || PRESETS.openrouter.baseUrl,
    apiKey: apiKeyEl.value.trim(),
    model: modelEl.value.trim() || PRESETS.openrouter.model,
    language: languageEl.value || DEFAULT_LANGUAGE,
  });
  statusEl.textContent = "Saved locally.";
  setTimeout(() => { statusEl.textContent = ""; }, 1500);
});

load();
