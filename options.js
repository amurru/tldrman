const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const statusEl = document.getElementById("status");

async function load() {
  const { apiKey = "", model = "openrouter/free" } = await chrome.storage.local.get(["apiKey", "model"]);
  apiKeyEl.value = apiKey;
  modelEl.value = model;
}

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    apiKey: apiKeyEl.value.trim(),
    model: modelEl.value.trim() || "openrouter/free",
  });
  statusEl.textContent = "Saved locally.";
  setTimeout(() => { statusEl.textContent = ""; }, 1500);
});

load();
