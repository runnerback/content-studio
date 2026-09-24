# Note Content Studio

> Version 3.11.14 · Updated 2026-09-24 · [简体中文](./README.zh-CN.md) · [Support on Afdian / 爱发电](https://afdian.com/a/note_content_studio)

Turn your Obsidian notes into ready-to-publish content: **WeChat Official Account** articles, **Xiaohongshu (rednote)** image cards, and **Feishu** cloud docs, all previewed live inside Obsidian.

## Features

- **WeChat articles**: live preview your Markdown as a WeChat-ready article (code blocks, quotes, local images, GIFs, math and diagrams all handled). Copy into the WeChat editor with one click, or save straight to your account's drafts.
- **Xiaohongshu image cards**: switch the preview to 小红书 mode and each heading becomes one image card. Images under a heading are laid out inline with the text (full width, height by aspect ratio); when a card cannot fit both, the image is split into its own card automatically. Style cards with themes (including an iOS-Notes look), then export as PNGs.
- **Feishu docs**: sync the same note to Feishu cloud documents.
- **AI layout and title polish** (optional): AI-assisted typesetting and title suggestions with your own API key.
- **Draft publishing to Xiaohongshu / X** (optional): push rendered cards to the platform draft box through a companion browser extension.

## Quick start

1. Click the **Content Studio** ribbon icon (or run the command `打开预览面板`) to open the preview panel.
2. Edit your note. The panel renders it live, with two-way scroll sync.
3. Use the panel toolbar to switch platform (公众号 / 小红书 / X), tweak styles, and publish via **发布与分发**.

## Setup

- **WeChat**: add your Official Account AppID/Secret in settings. WeChat's API enforces an IP whitelist, so requests go through a proxy **that you host yourself**. See [API proxy setup](./docs/guides/api-proxy.md); a reference proxy server is included in [`server/`](./server/README.md).
- **Feishu**: add your Feishu app credentials in settings.
- **AI features** (optional): configure an AI provider and API key in settings. See [AI provider setup](./docs/guides/ai-provider.md).
- **Xiaohongshu / X draft publishing** (optional, metered): requires the companion browser extension **Crosspost**, which is distributed separately and is not yet publicly available. Everything else works without it: card preview, PNG/ZIP export and copy.
  Publishing is metered per day: **Free** 3 publishes/day, **Pro** 30/day, **Max** unlimited. Pro and Max are paid licenses sold on [Afdian](https://afdian.com/a/note_content_studio) (Lemon Squeezy for overseas users coming later); paste the license key under Settings → 分发设置 → 其他平台. See [Quota and license](./docs/guides/quota-and-license.md).

## Network use and privacy

The plugin makes network requests only when you trigger an action, and only to services you configure:

- **WeChat API** (`api.weixin.qq.com`) through the proxy URL you set, when you upload images or save drafts to your Official Account.
- **Feishu Open API** (`open.feishu.cn`) when you sync a note to Feishu. Mermaid diagrams in Feishu sync are rendered remotely through `kroki.io`.
- **Your AI provider endpoint** (DeepSeek, OpenAI-compatible or Anthropic-compatible, whichever you configure) when you run AI layout or title polish.
- **Local WebSocket server** on `127.0.0.1:9527` (port configurable) for pairing the optional Crosspost extension. It only starts when multi-platform publishing is enabled in settings and accepts local connections only.
- **License service** (`api.runfast.xyz/license`) for the metered Xiaohongshu / X publishing: the extension sends an anonymous device ID, the license key (if any) and the platform name to count publishes; the plugin calls it only when you redeem an Afdian order number. No note content is sent.

Credentials (AppID/Secret, tokens, API keys, license key) are stored in the plugin's `data.json` inside your vault and are sent only to the services above. There is no telemetry or analytics. **Payment is required for full access** to Xiaohongshu / X publishing beyond the free daily quota.

## Manual install

Download `main.js` / `manifest.json` / `styles.css` from the latest release into `.obsidian/plugins/note-content-studio/`, then enable the plugin.

## Docs

See [`docs/guides/`](./docs/guides/) for proxy setup, AI provider setup, and Xiaohongshu publishing.

## Support the project

Note Content Studio is free and MIT licensed, developed and maintained by [runnerback](https://github.com/runnerback). If it saves you time, you can support it on **Afdian / 爱发电**: https://afdian.com/a/note_content_studio . The same page sells the Pro / Max licenses for metered Xiaohongshu / X publishing; every other feature stays free.

## Acknowledgements

Built on [obsidian-wechat-converter](https://github.com/davidlam-oss/obsidian-wechat-converter) by DavidLam and a TypeScript port of the [note-to-red](https://github.com/yeban8090/note-to-red) rendering engine by Yeban, both MIT licensed. Their copyright notices are retained in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## License

[MIT](./LICENSE)
