<p align="center"><img src="icons/icon-128.png" width="128" height="128" alt="tldrman logo"></p>

# tldrman (local-only Vivaldi Side Panel)

Vanilla MV3 extension, no build step. Summarizes the active tab via any
OpenAI-compatible LLM (OpenRouter free models are the default fallback),
with knowledge-shard export for Obsidian and a creator pack for social/reel output.

## Load in Vivaldi

1. Open `vivaldi://extensions`
2. Enable Developer mode (top right)
3. Load unpacked -> select this folder
4. Click the toolbar icon to open the Side Panel
5. Open Settings in the panel, paste OpenRouter key from https://openrouter.ai/keys
6. Default model `openrouter/free`. Or pin e.g. `google/gemini-flash-1.5:free`

## Providers (any OpenAI-compatible `/chat/completions` endpoint)

OpenRouter is the default fallback. Settings presets: OpenRouter, OpenAI,
Ollama (`http://localhost:11434/v1`, no key), LM Studio
(`http://localhost:1234/v1`, no key), or a custom base URL. The panel header
shows `host / model`. Local servers need no API key; remote ones do.

## Modes

Summarize (streamed):

- **TLDR** (`Alt+1`) - 1-2 sentence summary
- **Summary** (`Alt+2`) - short paragraph
- **Bullets** (`Alt+3`) - 5-8 key points
- **ELI5** (`Alt+4`) - simple explainer with analogy
- **Takeaways** (`Alt+5`) - takeaways + next steps

Knowledge:

- **Shards** (`Alt+6`) - technical recipe (Overview, Key concepts, How it works,
  Code/commands, Gotchas, References). **Export .md** downloads an
  Obsidian-ready file (`YYYY-MM-DD-slug.md` with YAML frontmatter).

Creator pack:

- **Post** (`Alt+7`) - one copy-paste social post (hook, body, hashtags, CTA)
- **Thread** (`Alt+8`) - 5-part X thread, each part under 260 chars
- **Reel** (`Alt+9`) - 30-45s Instagram reel script (titles, timed hook,
  Say/Show beats with B-roll cues, CTA, hashtags)

Extras: page-context Q&A (`/` focuses ask box), 20-item history with
click-restore, auto-summarize toggle, Copy/Clear, `Esc` stops streaming.
Output is rendered as markdown.

## Files

- `manifest.json` - MV3, static `side_panel.default_path` (avoids Vivaldi dynamic setOptions bug)
- `background.js` - opens panel on action click
- `sidepanel.*` - panel UI + read-only extractor + multi-provider streaming
- `options.*` - local-only provider/key/model storage (`chrome.storage.local`)

## Notes

- Needs `<all_urls>` host permission so the panel button can script any tab (panel clicks don't grant `activeTab`).
- The extractor never mutates the page: it reads live text and strips
  boilerplate only on a detached clone.
- Cannot read `chrome://`, `vivaldi://`, Web Store, PDFs.
- Page text truncated to ~12000 chars before sending.
- Remote free models are rate-limited; `402` means quota exhausted, `429` means slow down.
  Local providers (Ollama, LM Studio) have no quotas or keys.

## Compatibility

Blocking API is `chrome.sidePanel` (`manifest.json` `side_panel.default_path`
+ `sidePanel` permission + `background.js` `setPanelBehavior` / `open`).
The rest (`scripting.executeScript`, `storage.local`, `tabs`, `action`,
`options_ui`, service worker, `fetch` SSE streaming) is portable MV3.

| Browser | Engine | Side surface | Status | Notes |
|---|---|---|---|---|
| Vivaldi | Chromium | `chrome.sidePanel` | Verified | Primary target. Uses static `default_path`; avoids dynamic `setOptions` bug. |
| Chrome 114+ | Chromium | `chrome.sidePanel` | Expected, not yet tested | Reference implementation. `open()` needs a user gesture since 116; `action.onClicked` satisfies this. |
| Edge 114+ | Chromium | `chrome.sidePanel` | Expected, not yet tested | Same API as Chrome, surfaced as sidebar. |
| Brave | Chromium | `chrome.sidePanel` | Expected, not yet tested | Supports nearly all Chrome Web Store MV3 extensions; confirm sidebar renders panel. |
| Opera / Opera GX | Chromium | `chrome.sidePanel` MV3, legacy `sidebar_action` | Expected, not yet tested | Use MV3 path. Legacy `opr.sidebarAction` is a separate incompatible API. |
| Arc | Chromium | `chrome.sidePanel` | Expected, not yet tested | Same as Chrome, needs load-unpacked check. |
| Firefox Desktop / Zen | Gecko | `sidebarAction` (incompatible) | Requires port, not yet tested | No `sidePanel` support. Needs `sidebar_action: {default_panel}` manifest key + `sidebarAction.open()` rewrite. Panel HTML/JS is reusable with `browser.*` namespace or polyfill. Per-window, not per-tab. |
| Safari macOS / iOS | WebKit | None | Not supported | No docked panel. Closest fallback is `windows.create({type: "popup"})` with same document, plus `safari-web-extension-converter` packaging and Store distribution. |
| Mobile Chrome / Edge / Firefox Android / Safari iOS | Various | None | Not supported | No side panel surface; scripting and sideloading are restricted. |

Firefox/Safari notes:

- Firefox: `manifest.json` `side_panel` key and `sidePanel` permission are ignored. `background.js` panel-open logic must branch to `sidebarAction`. `tabs`, `scripting`, `storage` port with minor namespace changes.
- Safari: full rework, not just a manifest patch. Per-site permission model is stricter; audit `scripting` / `tabs` / `storage` behavior per version.
- `<all_urls>` + `scripting` works on Firefox desktop but changes install prompts and addons.mozilla.org review scrutiny.

## Verification status

- [x] Vivaldi: load unpacked, toolbar click opens panel, summarize active `http(s)` tab.
- [ ] Chrome 114+: load unpacked, toolbar click opens panel, summarize + streaming.
- [ ] Edge: same as Chrome.
- [ ] Brave: same as Chrome, confirm sidebar UI.
- [ ] Opera: same as Chrome via MV3 path.
- [ ] Firefox: only after `sidebar_action` port (separate manifest/background).
- [ ] Safari: only after popup-window fallback (no docked test possible).

To verify a Chromium browser: load unpacked, click toolbar icon, check panel opens, run TLDR on a normal `http(s)` page, confirm streaming output, history save, and options persist.
