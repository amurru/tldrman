# tldrman (local-only Vivaldi Side Panel)

Vanilla MV3 extension, no build step. Summarizes the active tab via OpenRouter free LLM.

## Load in Vivaldi

1. Open `vivaldi://extensions`
2. Enable Developer mode (top right)
3. Load unpacked -> select this folder
4. Click the toolbar icon to open the Side Panel
5. Open Settings in the panel, paste OpenRouter key from https://openrouter.ai/keys
6. Default model `openrouter/free`. Or pin e.g. `google/gemini-flash-1.5:free`

## Files

- `manifest.json` - MV3, static `side_panel.default_path` (avoids Vivaldi dynamic setOptions bug)
- `background.js` - opens panel on action click
- `sidepanel.*` - panel UI + extractor + OpenRouter call
- `options.*` - local-only key/model storage

## Notes

- Needs `<all_urls>` host permission so the panel button can script any tab (panel clicks don't grant `activeTab`).
- Cannot read `chrome://`, `vivaldi://`, Web Store, PDFs.
- Page text truncated to ~12000 chars before sending.
- Free models are rate-limited; `402` means quota exhausted.
