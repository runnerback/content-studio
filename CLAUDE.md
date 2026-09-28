# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **版本**: v3.12.0 ｜ **更新时间**: 2026-09-28（公式改用 Obsidian 自带 MathJax、包体 1.3MB；桌面版专用；设置项 i18n；分发看板；AI 用量；入口与 AI 服务拆分；本文件按当前结构全文校对）

## Language Preferences
- Detect the language of the user's prompt (English or Chinese). Always reply in the same language unless explicitly asked otherwise.
- When drafting replies or documentation intended for Chinese audiences, ensure natural, native-level phrasing.

## Commands

- **Install Dependencies**: `npm install --legacy-peer-deps`
- **Build for Production**: `npm run build` (generate:runtime + esbuild, minified, no sourcemaps)
- **Start Development Watcher**: `npm run dev`
- **Install into the vault**: `bash dev-install.sh` (target pinned by `.vault-path.local`; run after every change)
- **Unit tests**: `npm test -- --run` (Vitest + jsdom; `pretest` regenerates/validates generated files)
- **Full guard before tagging**: `npm run review:guard` = lint + risk-pattern scan + `scan:directory` (must be 0 problems) + tests + pack + validate
- Manual visual checks: `TEST.md` (rendering / WeChat compatibility) and the live preview pane.

## Architecture & Structure

- **Project Type**: Obsidian plugin, desktop only (`isDesktopOnly: true` since 3.12.0: the local WebSocket bridge and Feishu image handling use Node APIs).
- **Entry Point**: `input.js` bundles into `main.js` (≈1.3 MB minified). It holds the plugin lifecycle, the `AppleStyleView` class shell, view wiring and shared JSDoc typedefs; behaviour lives in mixins under `views/**` and services under `services/**`.
- **Core pieces**:
    - `converter.js`: markdown-it based Markdown → WeChat-compatible HTML (inline styles only).
    - `services/markdown-it-math.js` + `services/math-renderer.js`: math via **Obsidian's own MathJax (CHTML)**; `services/math-export.js` rasterizes `<mjx-container>` to PNG (html-to-image) when copying or saving drafts. No MathJax bundle ships with the plugin.
    - `services/ai-layout.js`: facade for AI 编排 (providers / core / render modules under `services/ai-layout/`); `services/ai-layout-runtime/` is generated from `ai-layout-skills/`.
    - `services/i18n.js` + `services/locales/{zh-cn,en}/*.js`: UI copy for settings, commands, card settings and the dashboard. `t('ns.key')`; both dictionaries must have identical keys (`tests/i18n.test.js`). Language rule: Obsidian zh / zh-TW → 简体中文, anything else → English.
    - `services/publish-status.js` / `services/platform-property.js` / `services/publish-dashboard-data.js`: frontmatter is the spine of distribution (`platform`, `publish_status`, `publish_pending`, `platform_<name>`); `views/dashboard/publish-dashboard.js` renders the 分发看板.
    - `views/settings/`: declarative settings tab (Obsidian 1.13 API) + imperative sub-pages (飞书 / 小红书图卡 / 小红书 & X extension). Phone frame and watermark live in the preview overlay (`views/settings-panel/settings-panel.js`), not in the settings tab.
    - `rednote/`: TypeScript port of note-to-red (Xiaohongshu / X image cards); backgrounds are WebP data URLs.
    - `styles.css`: **GENERATED** from `styles/src/*.css` by `npm run generate:styles`; never edit it directly.
    - `types/view-mixins.d.ts`: **GENERATED** by `npm run generate:view-types` from the mixins' JSDoc.
    - `lib/`: generated `markdown-it.min.js` and `highlight.min.js` only (`npm run generate:embedded`).
- **Build System**: `esbuild.config.mjs` → `main.js`, target es2018 / CommonJS; `obsidian`, `electron` and `@codemirror/*` are externals provided by the app.
- **WeChat Integration**: draft sync through the official API (needs the user's proxy for IP whitelisting), copy-to-editor with inline styles, image / cover / formula upload.
- **Companion extension**: Xiaohongshu / X drafts go through the private Crosspost extension over `ws://127.0.0.1:9527`. Until it is released, `CROSSPOST_EXTENSION_RELEASED` in `services/wechatsync-constants.js` is `false` and the UI says "尚未发行". Deliveries are recorded as `publish_status: pending`, never as a confirmed draft, because the extension only acknowledges receipt.

## Development Notes

- **Rebuild Requirement**: any source change requires `npm run build` (or `dev`) before Obsidian sees it; then `bash dev-install.sh`.
- **Version bump on every shipped change**: `manifest.json`, `package.json`, `versions.json`, README headers, `RELEASE_NOTES/v<version>.md`, `CHANGELOG.md`. Compliance-only fixes ride along with the next functional release (see `RELEASING.md`).
- **Zero-CSS Strategy for WeChat**: the editor strips `<style>` and classes; everything exported must be inline styles or images.
- **Math export**: WeChat and the clipboard do not understand `mjx-*` elements; `convertMathContainersToImages` (copy) and `processMathFormulas` (API) must run on a mounted DOM so html-to-image can measure the formula.
- **Circuit breaker**: fail fast on WeChat `45009` / `45001`.
- **Native components first** for UI; no manual pixel nudging for alignment.
- **State persistence**: per-file in-memory maps for transient UI state; clear them on view close.
- **No 兜底**: throw with a clear message instead of silently falling back; missing i18n keys, zero-size formulas and missing rasterizers are errors.

## Types & directory scan

- `npm run scan:directory` reproduces the Obsidian community directory scanner (`eslint.scan.config.mjs`, `--no-inline-config`). Target: 0 problems. Never suppress: no `eslint-disable`, `@ts-ignore`, `any`.
- The scanner has no `@types/node`: `tsconfig.scan.json` (`types: []`), `tsconfig.json` pins `lib` (ES2022 + DOM), `types/node-globals.d.ts` declares the `Buffer` / `require` surface used by desktop-only code.
- Gitignored generated modules need a committed `.d.ts` beside them (`services/ai-layout-runtime/generated-skills.d.ts`).
- View mixins get a typed `this` via `/** @satisfies {ThisType<AppleStyleViewInstance>} */`; declare every view / plugin member in the constructor (`/** @type {…} */ this.x = null;`).
- Shared typedefs live in `input.js`; other files import them with `/** @typedef {import('../../input.js').XLike} XLike */`. Value helpers (`toText`, `toRecord`, `toReadableError`, …) live in `services/input-utils.js`.
- Async hygiene: event handlers wrap async work as `() => { void this.doAsync(); }`; `async` without `await` becomes a sync function returning `Promise.resolve(...)`.
- `obsidianmd/ui/sentence-case` lowercases mid-sentence capitalized English words that are not brands / acronyms; write Chinese UI copy without such words. English dictionary strings are not scanned, so keep them in sentence case by hand.
- `rednote/` uses Obsidian's global DOM helpers (`createEl` / `createDiv` / …) and `window.setTimeout`; tests get the globals from `tests/helpers/obsidian-resolver.cjs`. The 小红书图卡 settings UI is a plain render class hosted by `views/settings/setting-pages.js`, deliberately not a `PluginSettingTab`.
- Tests that import services which pull `services/obsidian-adapters.js` must set `window.require = require` first (see `tests/helpers/input-module.cjs` / `tests/helpers/math-runtime.js`); `__mocks__/obsidian.js` provides `getLanguage`, `renderMath`, `loadMathJax`, `finishRenderMath`.

## Release

发布新版本时，使用 `/project-release` skill 查看完整流程；规则见 `RELEASING.md`。
