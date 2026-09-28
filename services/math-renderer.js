// services/math-renderer.js
//
// 公式渲染统一走 Obsidian 自带的 MathJax（tex-chtml-full，CHTML 输出）。
// 3.12.0 起不再打包 markdown-it-mathjax3 的 SVG 引擎（2.1MB，占 main.js 一半以上）：
//   - 预览：markdown-it 遇到 $…$ / $$…$$ 时调 renderMath() 得到 <mjx-container jax="CHTML">，
//     插入 DOM 后调 finishRenderMath() 让 MathJax 补齐字形样式；
//   - 导出（复制到公众号 / 公众号 API 草稿）：见 math-export.js，把 mjx-container 栅格化成 PNG。
// 这里只包 Obsidian API，不做任何"拿不到就退回"的兜底：宿主没有这几个函数就直接报错。

import { obsidianApi } from './obsidian-adapters.js';

/** @type {Promise<void> | null} */
let mathJaxLoadPromise = null;

/**
 * 确保 Obsidian 已加载 MathJax（幂等；失败后允许重试）。
 * @returns {Promise<void>}
 */
export function ensureMathJaxLoaded() {
  if (mathJaxLoadPromise === null) {
    const loader = /** @type {(() => Promise<void>) | undefined} */ (obsidianApi.loadMathJax);
    if (typeof loader !== 'function') {
      throw new Error('当前 Obsidian 不提供 loadMathJax()，无法渲染公式');
    }
    mathJaxLoadPromise = Promise.resolve(loader()).catch((error) => {
      mathJaxLoadPromise = null;
      throw error;
    });
  }
  return mathJaxLoadPromise;
}

/**
 * 把一段 TeX 渲染成 CHTML 片段（<mjx-container …>…</mjx-container>）。
 * 语法错误由 MathJax 自己渲染成 merror，不抛；宿主缺 renderMath 才抛。
 * @param {string} tex
 * @param {boolean} display 是否块级（$$…$$）
 * @returns {string}
 */
export function renderMathHtml(tex, display) {
  const render = /** @type {((source: string, display: boolean) => HTMLElement) | undefined} */ (obsidianApi.renderMath);
  if (typeof render !== 'function') {
    throw new Error('当前 Obsidian 不提供 renderMath()，无法渲染公式');
  }
  const element = render(String(tex ?? ''), Boolean(display));
  const html = element ? element.outerHTML : '';
  return typeof html === 'string' ? html : '';
}

/**
 * 渲染完成后调用：让 MathJax 把本轮用到的字形样式写进 CHTML 样式表。
 * 没有 finishRenderMath 的宿主（测试 mock）视为无事可做。
 * @returns {Promise<void>}
 */
export function finishMathRender() {
  const finish = /** @type {(() => Promise<void>) | undefined} */ (obsidianApi.finishRenderMath);
  return typeof finish === 'function' ? Promise.resolve(finish()) : Promise.resolve();
}
