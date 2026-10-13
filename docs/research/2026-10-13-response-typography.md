# Agent response readability

Research date: 2026-10-13. This is a presentation update to the existing Obsidian Agent, not a new renderer/backend.

## Sources and decisions

- [AI Elements Message](https://elements.ai-sdk.dev/components/message), [usage](https://elements.ai-sdk.dev/docs/usage): `Message → MessageContent → MessageResponse`, flat assistant content, actions below, first/last **direct** content edges trimmed. Source inspected at `vercel/ai-elements` commit `6a9d5b1822ffb10bba4bd97175f01edd7d8651cd`, `packages/elements/src/message.tsx` (Apache-2.0). Existing local adapted Message components already use this composition. Retain Obsidian MarkdownRenderer instead of importing Streamdown: vault links, embeds, postprocessor lifecycle and native code controls must remain host compatible. No new upstream source is copied.
- [assistant-ui Markdown](https://github.com/assistant-ui/assistant-ui/blob/f9e56437a067df208216d9dd57cf421c5f2a5f21/packages/ui/src/components/react/assistant-ui/elements/markdown-text.tsx), MIT: paragraphs have `my-3 leading-relaxed`, modest headings, spaced lists, a locally scrolling table, and fenced code controls. Borrow the rhythm, not Tailwind classes or a second chat runtime. Their decorative quote side border conflicts with this project's design; retain a neutral quote surface.
- [OpenAI formatting guidance](https://developers.openai.com/api/docs/guides/latest-model): ordinary conversation favors short paragraphs; headings, bold and lists should help comprehension. This is output guidance, not evidence of exact ChatGPT UI spacing. [Anthropic Constitution](https://www.anthropic.com/constitution): adapt format and length to the user's request, use Markdown when the surface renders it. This is likewise a behavior reference, not a measured Claude UI specification.
- [Obsidian directory management](https://docs.obsidian.md/community-directory/manage-entry): final-SHA preview scan and formal release scan remain separate gates.

## Reproduction and implementation

Official 0.6.0, real Obsidian in a separate synthetic vault:

- Three sentences separated by a single newline render as one `p` with two `br` nodes, with zero external margin. This reproduces the screenshot's uninterrupted lines.
- The same text with blank lines renders as three `p` nodes with 12px gaps at 15px body size. Thus CSS alone cannot solve models emitting single line breaks. Do not rewrite arbitrary Markdown or split every sentence: that would damage poems, quotations, lists, code and copied text.
- There is also a latent CSS issue: descendant `p:first-child/last-child` clears paragraph margins in host block wrappers. Restrict trimming to response boundaries, not every parent.

Apply shared CLI/API conversational formatting defaults (blank-line paragraphs, explicit user format wins), strengthen the reading shortcut's exactly-three-sentence contract, use 1em paragraph gaps, maintain 1.75 body leading and user font settings, cap prose at 76ch on wide panes, and improve heading/list/code/table/image rhythm. A response wrapper separates text and Mermaid segments. Keep raw response Markdown for copy/append and persistence.

No new dependencies or UI configuration. Existing Chinese labels and accessible Lucide actions stay intact; formatting guidance does not translate content. Physical mobile and individual user themes require separate verification.
