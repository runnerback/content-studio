// services/image-swipe.js
//
// 横滑图片块（image-swipe / image-sensitive）命令文案 + callout markdown 生成。
// 3.12.0：文案走统一的 i18n（services/i18n.js，按 Obsidian 语言中 / 英），不再自己探测 vault 语言配置。
// 对外只暴露 getImageSwipeCommandCopy / createImageSwipeCalloutMarkdown。

import { toText } from './input-utils.js';
import { t, getLocale } from './i18n.js';

/** @type {Record<string, { nameKey: string, titleKey: string, noticeKey: string }>} */
const IMAGE_SWIPE_COMMAND_KEYS = {
  'image-swipe': {
    nameKey: 'commands.imageSwipeName',
    titleKey: 'commands.imageSwipeTitle',
    noticeKey: 'commands.imageSwipeNotice',
  },
  'image-sensitive': {
    nameKey: 'commands.imageSensitiveName',
    titleKey: 'commands.imageSensitiveTitle',
    noticeKey: 'commands.imageSensitiveNotice',
  },
};

// 占位图片名是插进文档的示例 markdown，按语言给不同文件名
/** @type {Record<'zh-cn' | 'en', string[]>} */
const IMAGE_SWIPE_PLACEHOLDERS = {
  'zh-cn': ['![[图片1.png]]', '![[图片2.png]]'],
  en: ['![[image-1.png]]', '![[image-2.png]]'],
};

/**
 * @param {string} [type='image-swipe']
 * @returns {{ name: string, title: string, placeholder: string[], notice: string }}
 */
export function getImageSwipeCommandCopy(type = 'image-swipe') {
  const keys = IMAGE_SWIPE_COMMAND_KEYS[type] || IMAGE_SWIPE_COMMAND_KEYS['image-swipe'];
  return {
    name: t(keys.nameKey),
    title: t(keys.titleKey),
    placeholder: [...IMAGE_SWIPE_PLACEHOLDERS[getLocale()]],
    notice: t(keys.noticeKey),
  };
}

/**
 * @param {unknown} text
 * @returns {string}
 */
function quoteLinesForImageSwipeCallout(text) {
  const lines = toText(text).split('\n');
  return lines.map((line) => (line ? `> ${line}` : '>')).join('\n');
}

/**
 * @param {string} [type]
 * @param {string} [selectedText]
 * @returns {string}
 */
export function createImageSwipeCalloutMarkdown(type = 'image-swipe', selectedText = '') {
  const copy = getImageSwipeCommandCopy(type);
  const content = String(selectedText || '').trim()
    ? String(selectedText || '').replace(/\s+$/g, '')
    : copy.placeholder.join('\n');
  return `> [!${type}] ${copy.title}\n${quoteLinesForImageSwipeCallout(content)}`;
}
