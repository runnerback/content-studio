// services/math-export.js
//
// 导出时把 Obsidian MathJax 的 CHTML 公式（<mjx-container jax="CHTML">）栅格化成 PNG：
//   - 复制到公众号编辑器：换成 data:image/png 的 <img>（编辑器不认 mjx-* 自定义元素）
//   - 公众号 API 草稿：wechat-media.processMathFormulas 用这里的查找 / 替换，上传后换成微信 URL
// 栅格化用 html-to-image（图卡导出同一套），要求元素已挂到文档并完成排版（尺寸为 0 直接报错）。
// 旧的 SVG 公式路径（svg-rasterizer）仍保留给非公式的行内 SVG。

import { toBlob } from 'html-to-image';
import { finishMathRender } from './math-renderer.js';

export const MATH_CONTAINER_SELECTOR = 'mjx-container';
export const MATH_IMAGE_CLASS = 'math-formula-image';
export const MATH_INLINE_IMAGE_STYLE = 'display:inline-block; vertical-align:middle; margin:0 1px;';
export const MATH_BLOCK_WRAP_STYLE = 'display:block; width:100%; margin:1em auto; text-align:center; max-width:100%;';
export const MATH_BLOCK_IMAGE_STYLE = 'display:block; max-width:100%; height:auto; margin:0 auto;';
export const DEFAULT_MATH_PIXEL_RATIO = 3;

/**
 * @typedef {{ blob: Blob, width: number, height: number, display: boolean }} MathRasterResult
 * @typedef {{ dataUrl: string, width: number, height: number }} MathDataUrlCacheEntry
 * @typedef {(node: HTMLElement, options?: Record<string, unknown>) => Promise<Blob | null>} ToBlobLike
 */

/**
 * CHTML 公式容器（不含 SVG；含 SVG 的是旧 SVG 引擎输出，走 svg-rasterizer）。
 * @param {Element | null | undefined} el
 * @returns {el is HTMLElement}
 */
export function isChtmlMathContainer(el) {
  if (!el || typeof el.tagName !== 'string') return false;
  if (el.tagName.toLowerCase() !== MATH_CONTAINER_SELECTOR) return false;
  return !el.querySelector('svg');
}

/**
 * @param {ParentNode | null | undefined} root
 * @returns {HTMLElement[]}
 */
export function findMathContainers(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  return Array.from(root.querySelectorAll(MATH_CONTAINER_SELECTOR)).filter(isChtmlMathContainer);
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
export function isBlockMathContainer(el) {
  return el.getAttribute('display') === 'true';
}

/**
 * 同一公式（同显示模式）复用同一张图；outerHTML 已含 MathJax 展开后的全部结构。
 * @param {Element} el
 * @returns {string}
 */
export function getMathContainerFingerprint(el) {
  return `${isBlockMathContainer(el) ? 'block' : 'inline'}:${el.outerHTML}`;
}

/**
 * 栅格化一个已挂载的 CHTML 公式容器。
 * @param {HTMLElement} el
 * @param {{ pixelRatio?: number, toBlobImpl?: ToBlobLike }} [options]
 * @returns {Promise<MathRasterResult>}
 */
export async function rasterizeMathContainer(el, { pixelRatio = DEFAULT_MATH_PIXEL_RATIO, toBlobImpl = toBlob } = {}) {
  await finishMathRender();
  const rect = el.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  if (width <= 0 || height <= 0) {
    throw new Error('公式元素尺寸为 0，无法转成图片（需挂载到文档并完成排版）');
  }
  const blob = await toBlobImpl(el, { pixelRatio });
  if (!blob) {
    throw new Error('公式转图失败：html-to-image 未返回图片数据');
  }
  return { blob, width, height, display: isBlockMathContainer(el) };
}

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('读取公式图片失败'));
    reader.readAsDataURL(blob);
  });
}

/**
 * 用 <img> 替换公式容器：块级公式包一层居中的 <section>（独占一段的 <p> 一并替换），行内公式原位替换。
 * @param {HTMLElement} el
 * @param {{ src: string, width: number, height: number }} image
 * @returns {HTMLElement} 替换后的元素（img 或 section）
 */
export function replaceMathContainerWithImage(el, { src, width, height }) {
  const doc = el.ownerDocument;
  const img = doc.createElement('img');
  img.setAttribute('src', src);
  img.className = MATH_IMAGE_CLASS;
  img.setAttribute('width', String(width));
  img.setAttribute('height', String(height));

  if (isBlockMathContainer(el)) {
    img.setAttribute('style', MATH_BLOCK_IMAGE_STYLE);
    const wrapper = doc.createElement('section');
    wrapper.setAttribute('style', MATH_BLOCK_WRAP_STYLE);
    wrapper.appendChild(img);
    const parent = el.parentElement;
    const parentIsBareParagraph = !!parent
      && parent.tagName.toLowerCase() === 'p'
      && Array.from(parent.childNodes).every((node) => node === el || (node.nodeType === 3 && !/\S/.test(node.textContent || '')));
    if (parentIsBareParagraph && parent.parentElement) {
      parent.replaceWith(wrapper);
    } else {
      el.replaceWith(wrapper);
    }
    return wrapper;
  }

  img.setAttribute('style', `${MATH_INLINE_IMAGE_STYLE} width:${width}px; height:${height}px;`);
  el.replaceWith(img);
  return img;
}

/**
 * 把 root 里所有 CHTML 公式换成 data URL 图片（复制到公众号用）。root 必须已挂载到文档。
 * 任一公式转图失败即抛错：复制失败要让用户看到，不能悄悄把 mjx-* 粘进编辑器。
 * @param {HTMLElement} root
 * @param {{ cache?: Map<string, MathDataUrlCacheEntry>, pixelRatio?: number, toBlobImpl?: ToBlobLike, simpleHash?: (value: string) => string }} [options]
 * @returns {Promise<number>} 替换的公式数
 */
export async function convertMathContainersToImages(root, { cache, pixelRatio = DEFAULT_MATH_PIXEL_RATIO, toBlobImpl, simpleHash } = {}) {
  const containers = findMathContainers(root);
  if (containers.length === 0) return 0;
  /** @type {Map<string, MathDataUrlCacheEntry>} */
  const store = cache instanceof Map ? cache : new Map();
  const keyOf = (/** @type {HTMLElement} */ el) => {
    const raw = getMathContainerFingerprint(el);
    return typeof simpleHash === 'function' ? simpleHash(raw) : raw;
  };
  for (const el of containers) {
    const key = keyOf(el);
    let entry = store.get(key);
    if (!entry) {
      const raster = await rasterizeMathContainer(el, { pixelRatio, toBlobImpl });
      entry = { dataUrl: await blobToDataUrl(raster.blob), width: raster.width, height: raster.height };
      store.set(key, entry);
    }
    replaceMathContainerWithImage(el, { src: entry.dataUrl, width: entry.width, height: entry.height });
  }
  return containers.length;
}
