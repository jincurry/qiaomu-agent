# 0.6.1 acceptance

Date: 2026-10-13 (Asia/Shanghai). Scope: conversation output formatting and host Markdown layout.

- `npm run check`: typecheck, **422 tests passing / 1 existing skip**, production build passed. CLI argument paths and a real AI SDK API request carry the same formatting guidance; explicit output instructions follow the defaults.
- Real Obsidian **1.14.4** (installer 1.13.7), macOS, dedicated profile and synthetic vault `/tmp/qiaomu-agent-output-qa`; no personal vault content copied. Official 0.6.0 assets installed first, then candidate assets upgraded to 0.6.1 with manifests refreshed.
- Reproduced single-newline replies as one `p` with `br` nodes. True blank-line paragraphs changed from 12px to **15px** gaps at 15px text. A synthetic host wrapper around each paragraph gives **0px in 0.6.0**, **15px in 0.6.1**.
- Light/dark × widths **300/360/760px** × body font **15/20px**: paragraph gaps exactly 15/20px, line heights 26.25/35px, no panel horizontal overflow. Preserve font settings; no forced font-size reset.
- Mixed Markdown: headings, tight/nested/ordered lists, quotes, long links, fenced JavaScript, five-column table, wiki link, text before/after Mermaid. At 300px: content width/scroll width **236/236**, table **236/419**, code **236/1529**. Local horizontal scrolling works; code indentation and syntax highlighting stay native. Mermaid image displayed. Light/dark and scrolled table screenshots visually inspected.
- Clicked `[[排版验收]]` and confirmed the actual QA note opened. Clicked Copy and compared clipboard text byte-for-byte to raw response Markdown; restored the previous clipboard afterward. Existing note append tests passed.
- A real **Codex App Server** chat through the installed plugin returned exactly three Chinese sentences, separated by blank lines and rendered as three paragraphs; no headings or numbering. This is one actual model run, not a guarantee that every provider obeys instructions.
- Production dependency audit: zero findings. Existing dev-only audit findings (Obsidian SDK's moment, Vitest/Vite's source-map-js) are not bundled; dependency versions were not changed by this presentation patch.

Not covered: physical iOS/Android, every third-party theme, every provider's output, rewriting legacy responses that used only single line breaks. Raw saved replies remain unchanged. Official preview, frozen draft asset installation, anonymous release download, formal review and native update are separate subsequent gates.
