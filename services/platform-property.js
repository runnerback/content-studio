// services/platform-property.js
//
// 文档 frontmatter 的 `platform` 属性 → 预览平台。写在文档属性里的约定：
//   platform: wechat | rednote | x   （也接受下拉框上的中文标签 公众号 / 小红书 / X，以及 xiaohongshu / xhs / twitter）
// 不认识的值一律返回 null，调用方不做任何切换（其他人的笔记里本来就有 platform 字段时不会误切）。
import { normalizePlatformName } from './publish-status.js';

/** 文档属性名 */
export const PLATFORM_PROPERTY_KEY = 'platform';

/** @type {Readonly<Record<string, 'wechat' | 'rednote' | 'x'>>} 下拉框标签与常见别名 → 预览模式 */
const LABEL_TO_MODE = Object.freeze({
  wechat: 'wechat',
  '公众号': 'wechat',
  '微信公众号': 'wechat',
  rednote: 'rednote',
  '小红书': 'rednote',
  x: 'x',
  twitter: 'x',
});

/**
 * 单个 platform 值 → 预览模式；不认识返回 null。
 * @param {unknown} raw
 * @returns {'wechat' | 'rednote' | 'x' | null}
 */
function resolvePlatformMode(raw) {
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  if (!key) return null;
  return LABEL_TO_MODE[key] || LABEL_TO_MODE[normalizePlatformName(key)] || null;
}

/**
 * 从 frontmatter 读 platform 里的全部目标平台（3.12.0：支持数组 `platform: [rednote, x]` 一稿多发）。
 * 去重、保持书写顺序、跳过不认识的值；字符串视为单元素。
 * @param {Record<string, unknown> | null | undefined} frontmatter
 * @returns {Array<'wechat' | 'rednote' | 'x'>}
 */
export function resolvePlatformTargetsFromFrontmatter(frontmatter) {
  if (!frontmatter || typeof frontmatter !== 'object') return [];
  const raw = frontmatter[PLATFORM_PROPERTY_KEY];
  const values = Array.isArray(raw) ? raw : [raw];
  /** @type {Array<'wechat' | 'rednote' | 'x'>} */
  const out = [];
  for (const value of values) {
    const mode = resolvePlatformMode(value);
    if (mode && !out.includes(mode)) out.push(mode);
  }
  return out;
}

/**
 * 从 frontmatter 读 platform 并归一成预览模式；字符串或数组（取第一个能识别的）都接受。
 * @param {Record<string, unknown> | null | undefined} frontmatter
 * @returns {'wechat' | 'rednote' | 'x' | null}
 */
export function resolvePreviewModeFromFrontmatter(frontmatter) {
  const targets = resolvePlatformTargetsFromFrontmatter(frontmatter);
  return targets.length > 0 ? targets[0] : null;
}

/** 预览模式 → 浏览器扩展侧的平台 id（公众号不经扩展，无对应 id） */
const MODE_TO_BRIDGE_PLATFORM_ID = Object.freeze({ rednote: 'xiaohongshu', x: 'x' });

/**
 * 「发布与分发」按钮默认勾选哪些扩展平台（3.12.0 一稿多发）：当前预览模式对应的平台排第一，
 * 再补上 frontmatter `platform` 里其它经扩展发布的平台；公众号不在扩展链路里，忽略。
 * @param {'wechat' | 'rednote' | 'x' | string} mode 当前预览模式
 * @param {Array<'wechat' | 'rednote' | 'x'>} targets resolvePlatformTargetsFromFrontmatter 的结果
 * @returns {string[]} 扩展平台 id，如 ['xiaohongshu', 'x']
 */
export function resolvePreferredBridgePlatformIds(mode, targets) {
  /** @type {string[]} */
  const out = [];
  const push = (/** @type {string} */ value) => {
    const id = MODE_TO_BRIDGE_PLATFORM_ID[/** @type {'rednote' | 'x'} */ (value)];
    if (id && !out.includes(id)) out.push(id);
  };
  push(mode);
  for (const target of Array.isArray(targets) ? targets : []) push(target);
  return out;
}

