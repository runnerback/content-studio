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
 * 从 frontmatter 读 platform 并归一成预览模式；字符串或数组（取第一个）都接受。
 * @param {Record<string, unknown> | null | undefined} frontmatter
 * @returns {'wechat' | 'rednote' | 'x' | null}
 */
export function resolvePreviewModeFromFrontmatter(frontmatter) {
  if (!frontmatter || typeof frontmatter !== 'object') return null;
  let raw = frontmatter[PLATFORM_PROPERTY_KEY];
  if (Array.isArray(raw)) raw = raw[0];
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  if (!key) return null;
  return LABEL_TO_MODE[key] || LABEL_TO_MODE[normalizePlatformName(key)] || null;
}
