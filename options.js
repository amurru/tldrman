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
const statusEl = document.getElementById("status");

function guessPreset(baseUrl) {
  for (const [name, p] of Object.entries(PRESETS)) {
    if (p.baseUrl === (baseUrl || "").trim()) return name;
  }
  return "custom";
}

async function load() {
  const d = await chrome.storage.local.get(["apiKey", "model", "baseUrl"]);
  baseUrlEl.value = d.baseUrl || PRESETS.openrouter.baseUrl;
  apiKeyEl.value = d.apiKey || "";
  modelEl.value = d.model || PRESETS.openrouter.model;
  presetEl.value = guessPreset(baseUrlEl.value);
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
  });
  statusEl.textContent = "Saved locally.";
  setTimeout(() => { statusEl.textContent = ""; }, 1500);
});

load();
