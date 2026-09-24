# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Preferences
- Detect the language of the user's prompt (English or Chinese). Always reply in the same language unless explicitly asked otherwise.
- When drafting replies or documentation intended for Chinese audiences, ensure natural, native-level phrasing.

## Commands

- **Install Dependencies**: `npm install`
- **Build for Production**: `npm run build` (Minifies code, no sourcemaps)
- **Start Development Watcher**: `npm run dev` (Builds `main.js` and watches for changes)
- **Testing**: This project relies on manual visual testing.
    - Use `TEST.md` to verify rendering logic, style conversion, and WeChat compatibility.
    - Check the "Live Preview" pane in Obsidian to ensure "What You See Is What You Get".
- **Automated Testing**: `npm test` (Runs Vitest unit tests).
    - Always evaluate the need for new unit tests after significant logic changes.
    - Use the `universal-guardrails` skill to scaffold tests if needed.

## Architecture & Structure

- **Project Type**: Obsidian Plugin (Node.js environment within Electron).
- **Entry Point**: `input.js` is the source entry point, which bundles into `main.js`.
- **Core Components**:
    - `input.js`: Main plugin logic and lifecycle management.
    - `converter.js`: Handles Markdown to WeChat-compatible HTML conversion.
    - `styles.css`: **GENERATED FILE** — built by `scripts/build-styles.mjs` from `styles/src/*.css`. NEVER edit it directly; edit the module under `styles/src/` (numeric prefix = concat order; `1x-rednote-*.css` are the rednote/小红书 styles) then run `npm run generate:styles` (also runs inside `npm run build`/`dev`). `pretest` runs `check:styles` and fails if styles.css drifts from its sources.
    - `themes/`: Contains specific visual themes (Simple, Classic, Elegant).
    - `lib/`: Helper libraries (including the dynamically loaded `mathjax-plugin.js`).
- **Build System**:
    - **Main Bundle**: `esbuild` via `esbuild.config.mjs` (Targets `main.js`).
    - **Math Bundle**: `esbuild` via `esbuild.math.mjs` (Targets `lib/mathjax-plugin.js`).
    - Targets `es2018` / CommonJS.
- **WeChat Integration**:
    - Supports syncing to WeChat Drafts.
    - Uses a proxy (e.g., Cloudflare Worker) to handle CORS and IP whitelisting for WeChat API calls (logic likely in `input.js` or `converter.js`).
    - Handles image processing: Local images are converted/uploaded; supports avatars and covers.

## Development Notes

- **Language**: JavaScript/TypeScript (mixed).
- **External Dependencies**: `obsidian`, `electron`, and `@codemirror/*` packages are peer dependencies provided by the Obsidian app.
- **UI/UX**: The plugin adds a ribbon icon and a command "Open Wechat Converter". It uses a side panel for live preview.
- **Image Handling**: Special attention is needed for local image paths (absolute/relative/WikiLink) and GIF handling (size limits).

## Best Practices & Lessons Learned (v2.1 Math Update & v2.5 Math-to-Image)

### 1. Bundling & Dependencies
- **Avoid Dynamic Requires**: Libraries that use `require(path.join(__dirname, 'package.json'))` will crash in Obsidian. Use `esbuild`'s `define` to inject static versions or mock the file system if possible.
- **ESM vs CJS**: When bundling CJS libraries (like `markdown-it` plugins), be wary of default exports. Always check `module.default || module`.
- **Rebuild Requirement**: `input.js` is the source for `main.js`. **ANY change to `input.js` requires `npm run build` to take effect.** Restarting the plugin is not enough if you haven't rebuilt.

### 2. WeChat Compatibility
- **Zero-CSS Strategy**: WeChat strips `<style>` and class-based styling. All visual elements must be inline styles or self-contained SVGs.
- **Math Formula Strategy**:
    - **Upload as Image**: WeChat API has strict content length limits. Complex SVGs (MathJax) must be converted to PNGs and uploaded to WeChat servers to bypass this limit.
    - **Smart Recoloring**: MathJax formulas should be recolored (e.g., `#333333`) for better readability, but non-formula SVGs (e.g., Mermaid) must retain their original colors.
- **Circuit Breaker**: Implement fail-fast logic for API rate limits (`45009`) and quota limits (`45001`) to prevent wasted retries and poor UX.

### 3. Architecture (Dynamic Loading)
- **Separate Bundles**: Heavy features (like MathJax) are bundled separately (`lib/mathjax-plugin.js`) and loaded via `eval()` in `input.js` only when needed.
- **Global Scope**: When `eval`-ing code, do not assume `window` is available or writable in the same way. Use a safe global resolver (`const _global = typeof window ...`) to export functions from the dynamic bundle.

### 4. UI/UX & Styling
- **Native Components First**: Always prefer Obsidian's native UI components and browser-default styles (e.g., standard range inputs) over custom CSS hacks.
- **Vertical Alignment**: Avoid manually calculating margins for vertical centering (e.g., `margin-top: -8px`). Use flexbox or grid layouts where possible, or rely on standard form controls which are already optimized for the platform.
- **State Persistence**: For multi-document workflows, use in-memory maps (e.g., `Map<Path, State>`) to temporarily cache UI state (like cover images or toggle positions) per file. Clear this cache on plugin unload or view close to prevent memory leaks.

### 5. Engineering & Quality
- **Unit Testing**: Use `Vitest` + `jsdom`.
    - Mock Obsidian API (`requestUrl`, `Notice`) robustly using `vi.mock` factory functions or file-system mocks in CI.
    - **Always** add unit tests for new core logic (especially regex, data transformation, and error handling).
    - Use the `universal-guardrails` skill to maintain test infrastructure.
- **CI/CD**: Ensure CI environments (Node version) match toolchain requirements (e.g., Node 20+ for Vitest), even if the runtime target is lower (Node 16).

### 6. Modular Architecture
- Adhere to the refactored modular architecture. Do not pile rendering rules or core logic inside the entry file `input.js`.
- Keep the entry file `input.js` lightweight, focused only on plugin lifecycle, view wiring, settings UI, and top-level sync actions.
- Place markdown-it rules and conversion core in `converter.js`.
- Place styling rules in `themes/apple-theme.js`.
- Place preprocessing, path resolution, and cleaner logic in their respective modules under `services/`.

## Types & directory scan (2026-09-23)

- `npm run scan:directory` reproduces the Obsidian community directory scanner locally (`eslint.scan.config.mjs`: `eslint-plugin-obsidianmd` recommended + `typescript-eslint` type-checked rules over the same tsconfig, **with `--no-inline-config`**, so `eslint-disable` comments do not count). The target is `0 problems`; run it before tagging a release. The directory shows the type-aware findings as warnings and the obsidianmd rules (`no-static-styles-assignment`, `settings-tab/no-manual-html-headings`, `prefer-create-el`, `prefer-window-timers`, `no-nodejs-modules`, …) as errors.
- Never suppress: no `eslint-disable`, `@ts-ignore`, `any` (`{any}` in JSDoc, `as any`). Fix the type at its source instead.
- Gitignored build outputs are absent in CI and on the directory scanner: any imported generated module needs a committed `.d.ts` next to it (`services/ai-layout-runtime/generated-skills.d.ts`), otherwise the import is an error type there even though it is fine locally. To reproduce that environment, move the generated files aside and run the scan.
- View mixins (`views/**`) get a typed `this` via `/** @satisfies {ThisType<AppleStyleViewInstance>} */` on the mixin object. The mixins' method surface lives in `types/view-mixins.d.ts` (**generated**: `npm run generate:view-types`, verified by `pretest`); a method's return type comes from its JSDoc `@returns {XLike}` where `XLike` is a typedef from `input.js` or from the mixin file itself. `types/view-augment.d.ts` merges that surface into the `AppleStyleView` class (interface/class merge), so `this.someMixinMethod()` also resolves inside `input.js` class methods.
- Members assigned outside a constructor are invisible to TypeScript: declare every view member in the `AppleStyleView` constructor and every plugin member in the `AppleStylePlugin` constructor (`/** @type {…} */ this.x = null;`); otherwise `this.x` is `any`/unresolved and every downstream use is flagged.
- Shared JSDoc typedefs live in `input.js`; other files import them with `/** @typedef {import('../../input.js').XLike} XLike */`. Shared value helpers live in `services/input-utils.js`: `toText(unknown)` (replaces `String(value || '')` on unknown values), `toReadableError`, `isRecord` / `toRecord`, `toAiLayoutState` & co. (typed, not `any`).
- Async hygiene: event handlers wrap async work as `() => { void this.doAsync(); }`; `async` without `await` becomes a sync function returning `Promise.resolve(...)` when the signature must stay a Promise.
- `obsidianmd/ui/sentence-case` lowercases any capitalized English word mid-sentence that is not in its built-in brand/acronym lists (brands: Obsidian, OpenAI, GitHub, Markdown…; acronyms: API, URL, JSON, HTML, CSS, PDF, PNG, JPG, SVG, UI, ID, AI, LLM). Write UI copy in Chinese without such words (e.g. "开发者 ID 与密钥", "提示词", "AI 服务商", "本插件") rather than lowercasing product names.
- `rednote/` uses Obsidian's global DOM helpers (`createEl` / `createDiv` / `createSpan` / `createSvg`) and `window.setTimeout`; tests get the globals from `tests/helpers/obsidian-resolver.cjs`. The 小红书图卡 settings UI is `rednote/settings/RedSettingsPanel.ts`, a plain render class hosted by `views/settings/setting-pages.js` — it is deliberately **not** a `PluginSettingTab` (the directory flags `display()` on tabs as deprecated).

## Release

发布新版本时，使用 `/project-release` skill 查看完整流程。
