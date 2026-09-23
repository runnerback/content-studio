// 生成 types/view-mixins.d.ts：视图各 mixin 的方法面，供 input.js 的 AppleStyleViewInstance
// 与各 mixin 的 `@satisfies {ThisType<AppleStyleViewInstance>}` 使用（避免 typeof mixin 自引用）。
// 规则：返回类型优先取方法 JSDoc 的 @returns（XLike → import('../input.js').XLike；含本地类型名则退回 unknown），
// 无 @returns 时 async → Promise<unknown>、有 return 值 → unknown、否则 void；参数一律 unknown。
// 用法：node scripts/generate-view-mixins-types.mjs [--check]
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MIXINS = [
  "views/preview/render-pipeline.js", "views/settings-panel/rednote-settings-panel.js", "views/publish-modal/media-assets.js",
  "views/publish-modal/wechat-sync-modal.js", "views/ai-layout/ai-layout-panel.js", "views/settings-panel/settings-panel.js",
  "views/publish-modal/rednote-publish.js", "views/publish-modal/cover-picker.js", "views/publish-modal/multi-platform-result-modals.js",
  "views/publish-modal/wechat-sync-actions.js", "views/publish-modal/x-publish.js",
];
const OUT = path.join(ROOT, "types/view-mixins.d.ts");

const input = fs.readFileSync(path.join(ROOT, "input.js"), "utf8");
const typedefNames = new Set([...input.matchAll(/\}\}? ([A-Z][A-Za-z0-9]*Like)\s*$/gm)].map((m) => m[1])
  .concat([...input.matchAll(/@typedef \{[^\n]*\} ([A-Z][A-Za-z0-9]*Like)\b/g)].map((m) => m[1])));

/** 从 start（指向 `{`）起做花括号配对，返回配对的 `}` 下标 */
function braceEnd(src, start) {
  let depth = 0, str = null;
  for (let j = start; j < src.length; j++) {
    const c = src[j];
    if (str) { if (c === "\\") { j++; continue; } if (c === str) str = null; continue; }
    if (c === '"' || c === "'" || c === "`") { str = c; continue; }
    if (src.startsWith("//", j)) { j = src.indexOf("\n", j); continue; }
    if (src.startsWith("/*", j)) { j = src.indexOf("*/", j) + 1; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return j;
  }
  return src.length;
}
/** 从 JSDoc 文本里取 @returns {...} 的完整类型（支持嵌套花括号） */
function returnsType(doc) {
  const i = doc.search(/@returns? \{/);
  if (i < 0) return null;
  const open = doc.indexOf("{", i);
  let depth = 0;
  for (let j = open; j < doc.length; j++) {
    if (doc[j] === "{") depth++;
    else if (doc[j] === "}" && --depth === 0) return doc.slice(open + 1, j).trim();
  }
  return null;
}
function mapType(t) {
  const names = [...t.matchAll(/\b([A-Z][A-Za-z0-9]*Like)\b/g)].map((m) => m[1]);
  if (names.some((n) => !typedefNames.has(n))) return null;
  return t.replace(/\b([A-Z][A-Za-z0-9]*Like)\b/g, "import('../input.js').$1").replace(/\s*\n\s*\*?\s*/g, " ");
}

const out = [
  "// 由 scripts/generate-view-mixins-types.mjs 生成，请勿手改（npm run generate:view-types）。",
  "// 视图 mixin 的方法面：供 input.js 的 AppleStyleViewInstance 与各 mixin 的 ThisType 使用，避免 typeof mixin 自引用。",
  "export interface ViewMixinsLike {",
];
for (const rel of MIXINS) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const m = /^export const \w+Mixin =\s*\{/m.exec(src);
  if (!m) throw new Error(`${rel}: 找不到 mixin 对象字面量`);
  const objStart = m.index + m[0].length - 1;
  const body = src.slice(objStart, braceEnd(src, objStart));
  out.push(`  // ---- ${rel} ----`);
  for (const mm of body.matchAll(/^ {2}(async )?([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{/gm)) {
    const [, isAsync, name] = mm;
    const bodyStart = mm.index + mm[0].length - 1;
    const methodBody = body.slice(bodyStart, braceEnd(body, bodyStart));
    const before = body.slice(0, mm.index);
    const doc = /\/\*\*([\s\S]*?)\*\/\s*$/.exec(before);
    let ret = doc ? (() => { const t = returnsType(doc[1]); return t ? mapType(t) : null; })() : null;
    if (ret === null) ret = isAsync ? "Promise<unknown>" : (/^\s*return\s+[^;\n]/m.test(methodBody) ? "unknown" : "void");
    else if (isAsync && !ret.startsWith("Promise<")) ret = `Promise<${ret}>`;
    out.push(`  ${name}(...args: unknown[]): ${ret};`);
  }
}
out.push("}", "");
const text = out.join("\n");
if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  if (current !== text) { console.error("[view-mixins-types] types/view-mixins.d.ts 已过期，请运行 npm run generate:view-types"); process.exit(1); }
  console.log("[view-mixins-types] up to date");
} else {
  fs.writeFileSync(OUT, text);
  console.log(`[view-mixins-types] 写入 ${path.relative(ROOT, OUT)}（${out.length - 4} 行方法面）`);
}
