// 图文混排装载检查（rednote/cardFit.ts）：带图卡装不下 → 图片拆成独立卡；仍溢出的卡打标记；
// 只有标题+图片的卡、装得下的卡不动。jsdom 无布局，溢出量由 measure 注入。
import { describe, it, expect } from 'vitest';

const { fitCards, findInlineImageBlock, splitImageOutOfSection, overflowLines, listOverflowingPages, OVERFLOW_ATTR, IMAGE_ONLY_CLASS } = await import('../rednote/cardFit.ts');

function buildPreview(sectionsHtml) {
  const preview = document.createElement('div');
  preview.className = 'red-preview-container';
  preview.innerHTML = `<div class="red-image-preview"><div class="red-preview-header">头</div><div class="red-preview-content"><div class="red-content-container">${sectionsHtml}</div></div><div class="red-preview-footer">脚</div></div>`;
  document.body.appendChild(preview);
  return preview;
}
const textCard = (i, withImage) => `<section class="red-content-section" data-index="${i}"><h2>卡${i}</h2>${withImage ? '<p><img class="red-image" src="x.jpg"></p>' : ''}<p>正文${i}</p></section>`;
const sectionsOf = (preview) => Array.from(preview.querySelectorAll('.red-content-section'));

describe('cardFit', () => {
  it('findInlineImageBlock：取到图片所在的直系块级子元素；无图返回 null', () => {
    const preview = buildPreview(textCard(0, true) + textCard(1, false));
    const [withImg, noImg] = sectionsOf(preview);
    expect(findInlineImageBlock(withImg)?.tagName).toBe('P');
    expect(findInlineImageBlock(withImg)?.querySelector('img')).not.toBeNull();
    expect(findInlineImageBlock(noImg)).toBeNull();
  });

  it('带图卡溢出 → 图片拆成紧随其后的独立卡（标题克隆），原卡只剩文字且不再溢出', async () => {
    const preview = buildPreview(textCard(0, true) + textCard(1, false));
    // 第一次量：带图的卡 0 溢出 120px；拆掉图片后再量为 0；卡 1 不溢出
    const measure = (_p, section) => (section.querySelector('img') && section.textContent.includes('正文') ? 120 : 0);
    const result = await fitCards(preview, { measure, imageTimeoutMs: 0 });
    const sections = sectionsOf(preview);
    expect(sections).toHaveLength(3);
    expect(result.split).toEqual([0]);
    expect(result.overflowing).toEqual([]);
    expect(sections[0].querySelector('img')).toBeNull();
    expect(sections[0].textContent).toContain('正文0');
    expect(sections[1].classList.contains(IMAGE_ONLY_CLASS)).toBe(true);
    expect(sections[1].getAttribute('data-index')).toBe('0-img');
    expect(sections[1].querySelector('h2').textContent).toBe('卡0');
    expect(sections[1].querySelector('img')).not.toBeNull();
    expect(sections[1].textContent).not.toContain('正文0');
    expect(sections[2].getAttribute('data-index')).toBe('1');
    // 处理完不残留测量用的显隐类
    sections.forEach((s) => {
      expect(s.classList.contains('red-section-visible')).toBe(false);
      expect(s.classList.contains('red-section-hidden')).toBe(false);
    });
  });

  it('装得下的带图卡原样保留（图文同卡）', async () => {
    const preview = buildPreview(textCard(0, true));
    const result = await fitCards(preview, { measure: () => 0, imageTimeoutMs: 0 });
    expect(sectionsOf(preview)).toHaveLength(1);
    expect(sectionsOf(preview)[0].querySelector('img')).not.toBeNull();
    expect(result.split).toEqual([]);
  });

  it('纯文字卡溢出 → 不拆，只打 data-red-overflow 标记；overflowLines / listOverflowingPages 可读', async () => {
    const preview = buildPreview(textCard(0, false) + textCard(1, false));
    const result = await fitCards(preview, { measure: (_p, s) => (s.getAttribute('data-index') === '1' ? 60 : 0), imageTimeoutMs: 0 });
    const sections = sectionsOf(preview);
    expect(sections).toHaveLength(2);
    expect(result.overflowing).toEqual([1]);
    expect(sections[1].getAttribute(OVERFLOW_ATTR)).toBe('60');
    expect(overflowLines(sections[1])).toBe(3);
    expect(overflowLines(sections[0])).toBe(0);
    expect(listOverflowingPages(preview)).toEqual([2]);
  });

  it('只有标题 + 图片的卡溢出 → 不拆（无文字可留），打标记', async () => {
    const preview = buildPreview('<section class="red-content-section" data-index="0"><h2>图</h2><p><img class="red-image" src="x.jpg"></p></section>');
    const result = await fitCards(preview, { measure: () => 40, imageTimeoutMs: 0 });
    expect(sectionsOf(preview)).toHaveLength(1);
    expect(result.split).toEqual([]);
    expect(result.overflowing).toEqual([0]);
  });

  it('拆图后文字仍溢出 → 两张都在，文字卡带标记', async () => {
    const preview = buildPreview(textCard(0, true));
    let calls = 0;
    const result = await fitCards(preview, { measure: () => (++calls === 1 ? 200 : 30), imageTimeoutMs: 0 });
    const sections = sectionsOf(preview);
    expect(sections).toHaveLength(2);
    expect(result.split).toEqual([0]);
    expect(sections[0].getAttribute(OVERFLOW_ATTR)).toBe('30');
  });

  it('重复渲染幂等：再次 fitCards 不会二次拆分', async () => {
    const preview = buildPreview(textCard(0, true));
    await fitCards(preview, { measure: (_p, s) => (s.querySelector('img') && s.textContent.includes('正文') ? 120 : 0), imageTimeoutMs: 0 });
    await fitCards(preview, { measure: (_p, s) => (s.querySelector('img') && s.textContent.includes('正文') ? 120 : 0), imageTimeoutMs: 0 });
    expect(sectionsOf(preview)).toHaveLength(2);
  });

  it('splitImageOutOfSection 直接调用：无标题的 section 也能拆', () => {
    const section = document.createElement('section');
    section.className = 'red-content-section';
    section.innerHTML = '<p><img class="red-image" src="x.jpg"></p><p>正文</p>';
    document.body.appendChild(section);
    const imageSection = splitImageOutOfSection(section, findInlineImageBlock(section));
    expect(imageSection.previousElementSibling).toBe(section);
    expect(imageSection.querySelector('h2')).toBeNull();
    expect(section.querySelector('img')).toBeNull();
  });
});
