// services/markdown-it-math.js
//
// markdown-it 公式插件：识别 $…$、$$…$$、\(…\)、\[…\]，渲染交给 math-renderer（Obsidian 自带 MathJax）。
// 取代 3.11.x 打包的 markdown-it-mathjax3（内含 2.1MB SVG 引擎）。分界符规则与 markdown-it-katex 一致：
//   - 行内 $ 后不能紧跟空白；闭合 $ 前不能是空白、后不能紧跟数字（避免 "$5 和 $6" 被当公式）
//   - 反斜杠转义的 \$ 不算分界符
//   - 段内 $$…$$ 与独立成块的 $$ 都按块级（display）渲染
// 通过 dependency-loader 挂到 window.ObsidianWechatMath，converter.js 的 initMarkdownIt 原样调用。

import { renderMathHtml } from './math-renderer.js';

/**
 * @typedef {{ src: string, pos: number, posMax: number, pending: string, push: (type: string, tag: string, nesting: number) => MathTokenLike }} InlineStateLike
 * @typedef {{ content: string, markup: string, meta: Record<string, unknown> | null, block: boolean, map: number[] | null }} MathTokenLike
 * @typedef {{ src: string, bMarks: number[], eMarks: number[], tShift: number[], blkIndent: number, line: number, push: (type: string, tag: string, nesting: number) => MathTokenLike, getLines: (begin: number, end: number, indent: number, keepLastLF: boolean) => string }} BlockStateLike
 * @typedef {{ inline: { ruler: { before: (name: string, ruleName: string, fn: Function) => void } }, block: { ruler: { after: (name: string, ruleName: string, fn: Function, options: Record<string, unknown>) => void } }, renderer: { rules: Record<string, Function> } }} MarkdownItLike
 */

/**
 * 行内 $ 分界符是否成立（参照 markdown-it-katex）。
 * @param {InlineStateLike} state
 * @param {number} pos
 * @returns {{ canOpen: boolean, canClose: boolean }}
 */
function isValidDelim(state, pos) {
  const max = state.posMax;
  const prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1;
  const nextChar = pos + 1 <= max ? state.src.charCodeAt(pos + 1) : -1;
  let canOpen = true;
  let canClose = true;
  if (prevChar === 0x20 || prevChar === 0x09 || (nextChar >= 0x30 && nextChar <= 0x39)) {
    canClose = false;
  }
  if (nextChar === 0x20 || nextChar === 0x09) {
    canOpen = false;
  }
  return { canOpen, canClose };
}

/**
 * 从 from 起找下一个未被反斜杠转义的 needle。
 * @param {string} src
 * @param {string} needle
 * @param {number} from
 * @returns {number}
 */
function findUnescaped(src, needle, from) {
  let match = from;
  while ((match = src.indexOf(needle, match)) !== -1) {
    let pos = match - 1;
    while (src[pos] === '\\') pos -= 1;
    if ((match - pos) % 2 === 1) return match;
    match += 1;
  }
  return -1;
}

/**
 * @param {InlineStateLike} state
 * @param {boolean} silent
 * @returns {boolean}
 */
function mathInlineDollar(state, silent) {
  if (state.src[state.pos] !== '$') return false;

  // 段内 $$…$$：按块级渲染
  if (state.src[state.pos + 1] === '$') {
    const start = state.pos + 2;
    const match = findUnescaped(state.src, '$$', start);
    if (match === -1 || match === start) {
      if (!silent) state.pending += '$$';
      state.pos = start;
      return true;
    }
    if (!silent) {
      const token = state.push('math_inline', 'math', 0);
      token.markup = '$$';
      token.content = state.src.slice(start, match);
      token.meta = { display: true };
    }
    state.pos = match + 2;
    return true;
  }

  let res = isValidDelim(state, state.pos);
  if (!res.canOpen) {
    if (!silent) state.pending += '$';
    state.pos += 1;
    return true;
  }

  const start = state.pos + 1;
  const match = findUnescaped(state.src, '$', start);
  if (match === -1) {
    if (!silent) state.pending += '$';
    state.pos = start;
    return true;
  }
  if (match - start === 0) {
    if (!silent) state.pending += '$$';
    state.pos = start + 1;
    return true;
  }

  res = isValidDelim(state, match);
  if (!res.canClose) {
    if (!silent) state.pending += '$';
    state.pos = start;
    return true;
  }

  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.markup = '$';
    token.content = state.src.slice(start, match);
    token.meta = { display: false };
  }
  state.pos = match + 1;
  return true;
}

/**
 * \(…\) 行内与 \[…\] 块级（LaTeX 风格分界符）。放在 escape 规则之前，否则 \( 会被当成转义。
 * @param {InlineStateLike} state
 * @param {boolean} silent
 * @returns {boolean}
 */
function mathInlineBracket(state, silent) {
  if (state.src[state.pos] !== '\\') return false;
  const opener = state.src[state.pos + 1];
  if (opener !== '(' && opener !== '[') return false;
  const closer = opener === '(' ? '\\)' : '\\]';
  const start = state.pos + 2;
  const match = state.src.indexOf(closer, start);
  if (match === -1) return false;
  if (!silent) {
    const token = state.push('math_inline', 'math', 0);
    token.markup = opener === '(' ? '\\(' : '\\[';
    token.content = state.src.slice(start, match);
    token.meta = { display: opener === '[' };
  }
  state.pos = match + 2;
  return true;
}

/**
 * 独立成块的 $$ … $$（可多行）。
 * @param {BlockStateLike} state
 * @param {number} start
 * @param {number} end
 * @param {boolean} silent
 * @returns {boolean}
 */
function mathBlock(state, start, end, silent) {
  let pos = state.bMarks[start] + state.tShift[start];
  let max = state.eMarks[start];
  if (pos + 2 > max) return false;
  if (state.src.slice(pos, pos + 2) !== '$$') return false;

  pos += 2;
  let firstLine = state.src.slice(pos, max);
  if (silent) return true;

  let found = false;
  let lastLine = '';
  let next = start;
  if (firstLine.trim().slice(-2) === '$$') {
    // 单行 $$…$$
    firstLine = firstLine.trim().slice(0, -2);
    found = true;
  }

  while (!found) {
    next += 1;
    if (next >= end) break;
    pos = state.bMarks[next] + state.tShift[next];
    max = state.eMarks[next];
    if (pos < max && state.tShift[next] < state.blkIndent) break; // 缩进回退：块结束
    if (state.src.slice(pos, max).trim().slice(-2) === '$$') {
      const lastPos = state.src.slice(0, max).lastIndexOf('$$');
      lastLine = state.src.slice(pos, lastPos);
      found = true;
    }
  }

  state.line = next + 1;
  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.content = (firstLine && firstLine.trim() ? `${firstLine}\n` : '')
    + state.getLines(start + 1, next, state.tShift[start], true)
    + (lastLine && lastLine.trim() ? lastLine : '');
  token.map = [start, state.line];
  token.markup = '$$';
  return true;
}

/**
 * markdown-it 插件入口（与旧 window.ObsidianWechatMath 同签名，options 未用）。
 * @param {MarkdownItLike} md
 */
export function markdownItMath(md) {
  md.inline.ruler.before('escape', 'math_inline_bracket', mathInlineBracket);
  md.inline.ruler.before('escape', 'math_inline', mathInlineDollar);
  md.block.ruler.after('blockquote', 'math_block', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
  md.renderer.rules.math_inline = (/** @type {MathTokenLike[]} */ tokens, /** @type {number} */ idx) => {
    const token = tokens[idx];
    const display = Boolean(token.meta && token.meta.display);
    return renderMathHtml(token.content, display);
  };
  md.renderer.rules.math_block = (/** @type {MathTokenLike[]} */ tokens, /** @type {number} */ idx) => (
    `${renderMathHtml(tokens[idx].content, true)}\n`
  );
}
