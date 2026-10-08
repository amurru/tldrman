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
