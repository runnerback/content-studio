// tests/math_export.test.js
//
// 3.12.0：公式改用 Obsidian 自带 MathJax（CHTML）。这里覆盖
//   - markdown-it 公式插件：$…$ / $$…$$ / \(…\) / \[…\] 的识别与分界符规则
//   - math-export：CHTML 容器查找、指纹、栅格化（html-to-image 打桩）与 <img> 替换、复制链路整体转换
//   - wechat-media.processMathFormulas 的 CHTML 分支（上传 + 缓存 + 替换）
import { describe, it, expect, vi } from 'vitest';

// obsidian-adapters 在测试里靠 window.require 拿到 __mocks__/obsidian.js（同 tests/helpers/input-module.cjs）
if (typeof window.require !== 'function') window.require = require;

const { markdownItMath } = require('../services/markdown-it-math.js');
const {
  findMathContainers,
  isBlockMathContainer,
  getMathContainerFingerprint,
  rasterizeMathContainer,
  replaceMathContainerWithImage,
  convertMathContainersToImages,
  MATH_IMAGE_CLASS,
} = require('../services/math-export.js');
const { processMathFormulas } = require('../services/wechat-media.js');

function createMd() {
  const markdownit = require('../lib/markdown-it.min.js');
  const md = markdownit({ html: true, breaks: true });
  md.use(markdownItMath);
  return md;
}

/** 给 jsdom 里的元素一个可用的尺寸 */
function withRect(el, width, height) {
  el.getBoundingClientRect = () => ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON() { return {}; } });
  return el;
}

const fakeBlob = () => new Blob(['png'], { type: 'image/png' });
const pMap = async (items, mapper) => { for (const item of items) await mapper(item); };

describe('markdown-it 公式插件（Obsidian MathJax CHTML）', () => {
  it('行内 $…$ 渲染为 CHTML 容器，块级 $$…$$ 带 display="true"', () => {
    const md = createMd();
    const inline = md.render('能量 $E=mc^2$ 守恒');
    expect(inline).toContain('<mjx-container class="MathJax" jax="CHTML">');
    expect(inline).toContain('E=mc^2');
    expect(inline).not.toContain('display="true"');

    const block = md.render('$$\n\\sum_{i=1}^n i\n$$');
    expect(block).toContain('display="true"');
    expect(block).toContain('\\sum_{i=1}^n i');
  });

  it('价格里的美元符号不是公式；反斜杠转义的 \\$ 不是分界符', () => {
    const md = createMd();
    expect(md.render('价格 $5 和 $6 对比')).not.toContain('mjx-container');
    expect(md.render('转义 \\$x\\$ 不渲染')).not.toContain('mjx-container');
  });

  it('支持 \\(…\\) 行内与 \\[…\\] 块级分界符，段内 $$…$$ 按块级', () => {
    const md = createMd();
    const inline = md.render('看 \\(a+b\\) 这里');
    expect(inline).toContain('<mjx-container class="MathJax" jax="CHTML">');
    expect(inline).toContain('a+b');
    const bracketBlock = md.render('\\[x^2\\]');
    expect(bracketBlock).toContain('display="true"');
    const inlineDisplay = md.render('公式 $$y=kx$$ 结束');
    expect(inlineDisplay).toContain('display="true"');
    expect(inlineDisplay).toContain('y=kx');
  });

  it('引用块内的多行 $$ 也能识别为块级公式', () => {
    const md = createMd();
    const html = md.render(['> $$', '> a=b', '> $$'].join('\n'));
    expect(html).toContain('<blockquote>');
    expect(html).toContain('display="true"');
    expect(html).toContain('a=b');
  });
});

describe('math-export：CHTML 公式容器 → 图片', () => {
  function mountHtml(html) {
    const root = document.createElement('div');
    root.innerHTML = html;
    document.body.appendChild(root);
    return root;
  }
  const INLINE = '<mjx-container class="MathJax" jax="CHTML"><mjx-math><mjx-mtext>a+b</mjx-mtext></mjx-math></mjx-container>';
  const BLOCK = '<mjx-container class="MathJax" jax="CHTML" display="true"><mjx-math><mjx-mtext>x^2</mjx-mtext></mjx-math></mjx-container>';
  const LEGACY_SVG = '<mjx-container class="MathJax" jax="SVG"><svg viewBox="0 0 1 1"></svg></mjx-container>';

  it('只找 CHTML 容器，跳过旧 SVG 容器；指纹区分行内 / 块级', () => {
    const root = mountHtml(`<p>${INLINE}</p>${BLOCK}${LEGACY_SVG}`);
    const found = findMathContainers(root);
    expect(found).toHaveLength(2);
    expect(isBlockMathContainer(found[0])).toBe(false);
    expect(isBlockMathContainer(found[1])).toBe(true);
    expect(getMathContainerFingerprint(found[0]).startsWith('inline:')).toBe(true);
    expect(getMathContainerFingerprint(found[1]).startsWith('block:')).toBe(true);
    root.remove();
  });

  it('栅格化读元素尺寸并交给 html-to-image；尺寸为 0 直接报错', async () => {
    const root = mountHtml(INLINE);
    const el = withRect(findMathContainers(root)[0], 42.2, 17.6);
    const toBlobImpl = vi.fn(async () => fakeBlob());
    const result = await rasterizeMathContainer(el, { pixelRatio: 3, toBlobImpl });
    expect(toBlobImpl).toHaveBeenCalledWith(el, { pixelRatio: 3 });
    expect(result).toMatchObject({ width: 43, height: 18, display: false });
    expect(result.blob).toBeInstanceOf(Blob);

    const zero = withRect(mountHtml(INLINE).querySelector('mjx-container'), 0, 0);
    await expect(rasterizeMathContainer(zero, { toBlobImpl })).rejects.toThrow(/尺寸为 0/);
    root.remove();
  });

  it('行内公式原位换 <img>（带宽高）；独占一段的块级公式连同 <p> 换成居中 section', () => {
    const root = mountHtml(`<p>前 ${INLINE} 后</p><p>${BLOCK}</p>`);
    const [inlineEl, blockEl] = findMathContainers(root);
    const img = replaceMathContainerWithImage(inlineEl, { src: 'data:image/png;base64,AAA', width: 40, height: 16 });
    expect(img.tagName).toBe('IMG');
    expect(img.className).toBe(MATH_IMAGE_CLASS);
    expect(img.getAttribute('style')).toContain('width:40px; height:16px');
    expect(root.querySelector('p').textContent).toContain('前');

    const wrapper = replaceMathContainerWithImage(blockEl, { src: 'https://mmbiz.qpic.cn/x.png', width: 200, height: 60 });
    expect(wrapper.tagName).toBe('SECTION');
    expect(wrapper.getAttribute('style')).toContain('text-align:center');
    expect(root.querySelectorAll('p')).toHaveLength(1);
    expect(root.querySelector('section img').getAttribute('src')).toBe('https://mmbiz.qpic.cn/x.png');
    root.remove();
  });

  it('复制链路：同一公式只栅格化一次，全部换成 data URL 图片', async () => {
    const root = mountHtml(`<p>${INLINE} 与 ${INLINE}</p>${BLOCK}`);
    findMathContainers(root).forEach((el) => withRect(el, 30, 12));
    const toBlobImpl = vi.fn(async () => fakeBlob());
    const count = await convertMathContainersToImages(root, { toBlobImpl, cache: new Map() });
    expect(count).toBe(3);
    expect(toBlobImpl).toHaveBeenCalledTimes(2);
    expect(root.querySelectorAll('mjx-container')).toHaveLength(0);
    const imgs = Array.from(root.querySelectorAll('img'));
    expect(imgs).toHaveLength(3);
    imgs.forEach((img) => expect(img.getAttribute('src')).toMatch(/^data:image\/png;base64,/));
    root.remove();
  });
});

describe('wechat-media.processMathFormulas：CHTML 分支', () => {
  it('栅格化 → 上传 → 换成微信 URL；相同公式命中缓存不重复上传', async () => {
    const html = '<p>A <mjx-container class="MathJax" jax="CHTML"><mjx-math><mjx-mtext>k</mjx-mtext></mjx-math></mjx-container>'
      + ' B <mjx-container class="MathJax" jax="CHTML"><mjx-math><mjx-mtext>k</mjx-mtext></mjx-math></mjx-container></p>';
    const api = { uploadImage: vi.fn(async () => ({ url: 'https://mmbiz.qpic.cn/math.png' })) };
    const rasterizeMath = vi.fn(async () => ({ blob: fakeBlob(), width: 20, height: 10, display: false }));
    const svgToPngBlob = vi.fn();
    const progress = vi.fn();
    const out = await processMathFormulas({
      html, api, progressCallback: progress, pMap, simpleHash: (v) => String(v.length),
      svgUploadCache: new Map(), svgToPngBlob, rasterizeMathContainer: rasterizeMath,
    });
    expect(api.uploadImage).toHaveBeenCalledTimes(1);
    expect(rasterizeMath).toHaveBeenCalledTimes(1);
    expect(svgToPngBlob).not.toHaveBeenCalled();
    expect(out).not.toContain('mjx-container');
    expect((out.match(/https:\/\/mmbiz\.qpic\.cn\/math\.png/g) || []).length).toBe(2);
    expect(progress).toHaveBeenLastCalledWith(2, 2);
  });

  it('有 CHTML 公式却没给转图实现时报错，不悄悄放过', async () => {
    const html = '<mjx-container class="MathJax" jax="CHTML"><mjx-math><mjx-mtext>k</mjx-mtext></mjx-math></mjx-container>';
    await expect(processMathFormulas({
      html, api: { uploadImage: vi.fn() }, pMap, simpleHash: (v) => v, svgUploadCache: new Map(), svgToPngBlob: vi.fn(),
    })).rejects.toThrow(/rasterizeMathContainer/);
  });
});
