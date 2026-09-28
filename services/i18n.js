// services/i18n.js
//
// 设置界面文案的中英切换（3.12.0）。规则按用户拍板：
//   Obsidian 语言为中文（简体 zh / 繁体 zh-TW）→ 简体中文；其它语言 → 英文。
// 字典按命名空间拆在 services/locales/{zh-cn,en}/*.js，两套 key 必须完全一致（tests/i18n.test.js 校验）。
// 用法：t('settingsTab.groupStyle')；带参数 t('feishu.apiUsage', { count: 3 }) → 模板里写 {count}。
// 不做"缺 key 回退到中文"的兜底：缺 key 直接抛错，由完整性测试提前暴露。

import { obsidianApi } from './obsidian-adapters.js';
import { ZH_CN } from './locales/zh-cn.js';
import { EN } from './locales/en.js';

/** @typedef {'zh-cn' | 'en'} Locale */

/** @type {Record<Locale, Readonly<Record<string, string>>>} */
const DICTIONARIES = { 'zh-cn': ZH_CN, en: EN };

/** @type {Locale | null} */
let cachedLocale = null;

/**
 * Obsidian 语言代码 → 本插件的两种界面语言。
 * @param {unknown} language getLanguage() 的返回值（en / zh / zh-TW / ja …）
 * @returns {Locale}
 */
export function resolveLocale(language) {
  const code = typeof language === 'string' ? language.trim().toLowerCase() : '';
  return code.startsWith('zh') ? 'zh-cn' : 'en';
}

/**
 * 当前界面语言（首次调用时读 Obsidian 的 getLanguage()，之后缓存；改语言需重启 Obsidian，与宿主一致）。
 * @returns {Locale}
 */
export function getLocale() {
  if (cachedLocale === null) {
    const getLanguage = /** @type {(() => string) | undefined} */ (obsidianApi.getLanguage);
    if (typeof getLanguage !== 'function') {
      throw new Error('当前 Obsidian 不提供 getLanguage()，无法确定界面语言');
    }
    cachedLocale = resolveLocale(getLanguage());
  }
  return cachedLocale;
}

/**
 * 测试用：清掉缓存，让下一次 getLocale() 重新读 getLanguage()。
 */
export function resetLocaleCache() {
  cachedLocale = null;
}

/**
 * @param {string} template
 * @param {Record<string, string | number> | undefined} params
 * @returns {string}
 */
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const key = String(name);
    return Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match;
  });
}

/**
 * 取当前语言的文案。
 * @param {string} key 形如 namespace.name
 * @param {Record<string, string | number>} [params]
 * @returns {string}
 */
export function t(key, params) {
  const dictionary = DICTIONARIES[getLocale()];
  const template = dictionary[key];
  if (typeof template !== 'string') {
    throw new Error(`缺少界面文案：${key}（${getLocale()}）`);
  }
  return interpolate(template, params);
}

/**
 * 供测试与完整性检查：两套字典本体。
 */
export const LOCALE_DICTIONARIES = DICTIONARIES;
