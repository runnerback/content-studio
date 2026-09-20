// 图文混排的"装得下"检查（2026-09-20）：
// 1. 量出卡片内容区可用高度，写成 CSS 变量 --red-content-h，供 .red-image 的 max-height 按比例取值；
// 2. 逐卡测量实际溢出：卡片固定 3:4 且 overflow:hidden，溢出即被裁掉且预览无感；
// 3. 带图卡装不下 → 把图片单独拆成一张卡（标题沿用，与 --- 分页一致），文字卡留下纯文字；
// 4. 仍溢出的卡打上 data-red-overflow="<px>"，由视图角标与导出 Notice 提示。
// 测量依赖真实布局；测试环境（jsdom）无布局时通过 measure 注入。

export const OVERFLOW_ATTR = 'data-red-overflow';
export const IMAGE_ONLY_CLASS = 'red-section-image-only';
const VISIBLE_CLASS = 'red-section-visible';
const HIDDEN_CLASS = 'red-section-hidden';
/** 估算"超出几行"用的行高（16px 字号 × 1.8 行距） */
const LINE_HEIGHT_PX = 29;

export interface CardFitOptions {
    /** 返回当前唯一可见的 section 在卡片里溢出的像素数（≤0 表示装得下） */
    measure?: (imagePreview: HTMLElement, section: HTMLElement) => number;
    /** 等图片加载的上限（vault 本地图片通常几十毫秒；到时未加载就按当前尺寸测量），测试传 0 */
    imageTimeoutMs?: number;
}
const DEFAULT_IMAGE_TIMEOUT_MS = 2000;

export interface CardFitResult {
    /** 被拆出图片卡的原卡索引（拆分前的顺序） */
    split: number[];
    /** 处理完仍溢出的卡索引（拆分后的顺序，从 0 起） */
    overflowing: number[];
}

/** 等图片加载完再测量；已加载 / 加载失败 / 测试环境无 decode 都直接放行 */
export async function waitForImages(root: HTMLElement, timeoutMs = DEFAULT_IMAGE_TIMEOUT_MS): Promise<void> {
    const images = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete);
    if (images.length === 0 || timeoutMs <= 0) return;
    await new Promise<void>((resolve) => {
        let pending = images.length;
        const done = () => { if (--pending === 0) resolve(); };
        const timer = setTimeout(resolve, timeoutMs);
        for (const img of images) {
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
        }
        // 全部加载完时清掉定时器（resolve 幂等，重复调用无副作用）
        void Promise.resolve().then(() => { if (pending === 0) clearTimeout(timer); });
    });
}

function defaultMeasure(imagePreview: HTMLElement): number {
    return imagePreview.scrollHeight - imagePreview.clientHeight;
}

/** 内容区可用高度 = 卡片内高 − 页眉 − 页脚；无布局（jsdom）时为 0，调用方跳过 */
export function computeContentHeight(imagePreview: HTMLElement): number {
    if (!imagePreview.clientHeight) return 0;
    const style = getComputedStyle(imagePreview);
    const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const header = imagePreview.querySelector<HTMLElement>('.red-preview-header');
    const footer = imagePreview.querySelector<HTMLElement>('.red-preview-footer');
    return Math.max(0, imagePreview.clientHeight - padding - (header?.offsetHeight || 0) - (footer?.offsetHeight || 0));
}

/** section 里直接承载嵌入图片的块级子元素（Obsidian 把 ![]() 渲染成 <p><img></p>） */
export function findInlineImageBlock(section: HTMLElement): HTMLElement | null {
    const img = section.querySelector<HTMLElement>('img.red-image');
    if (!img) return null;
    let block: HTMLElement = img;
    while (block.parentElement && block.parentElement !== section) block = block.parentElement;
    return block.parentElement === section ? block : null;
}

/** 图片块之外还有正文吗（只有标题 + 图片的卡不算"混排"，无需拆） */
function hasTextBesidesImage(section: HTMLElement, imageBlock: HTMLElement, heading: Element | null): boolean {
    return Array.from(section.children).some((child) => child !== imageBlock && child !== heading && (child.textContent || '').trim() !== '');
}

/**
 * 把 section 里的图片块拆成紧随其后的独立图片卡（标题克隆一份），返回新卡。
 */
export function splitImageOutOfSection(section: HTMLElement, imageBlock: HTMLElement): HTMLElement {
    const heading = section.firstElementChild && /^H[1-6]$/.test(section.firstElementChild.tagName) ? section.firstElementChild : null;
    const imageSection = document.createElement('section');
    imageSection.className = `red-content-section ${IMAGE_ONLY_CLASS}`;
    imageSection.setAttribute('data-index', `${section.getAttribute('data-index') || ''}-img`);
    if (heading) imageSection.appendChild(heading.cloneNode(true));
    imageSection.appendChild(imageBlock);
    section.insertAdjacentElement('afterend', imageSection);
    return imageSection;
}

function showOnly(sections: HTMLElement[], target: HTMLElement): void {
    for (const section of sections) {
        section.classList.toggle(VISIBLE_CLASS, section === target);
        section.classList.toggle(HIDDEN_CLASS, section !== target);
    }
}

function clearVisibility(sections: HTMLElement[]): void {
    for (const section of sections) {
        section.classList.remove(VISIBLE_CLASS, HIDDEN_CLASS);
        section.removeAttribute(OVERFLOW_ATTR);
    }
}

/**
 * 对预览容器里的全部卡做一遍"装得下"处理。必须在模板（页眉/页脚）应用之后调用。
 */
export async function fitCards(previewEl: HTMLElement, options: CardFitOptions = {}): Promise<CardFitResult> {
    const result: CardFitResult = { split: [], overflowing: [] };
    const imagePreview = previewEl.querySelector<HTMLElement>('.red-image-preview');
    if (!imagePreview) return result;

    const contentHeight = computeContentHeight(imagePreview);
    if (contentHeight > 0) imagePreview.style.setProperty('--red-content-h', `${contentHeight}px`);
    await waitForImages(imagePreview, options.imageTimeoutMs);

    const measure = options.measure || defaultMeasure;
    const original = Array.from(previewEl.querySelectorAll<HTMLElement>('.red-content-section'));
    clearVisibility(original);
    // 拆分会插入新卡，遍历时以当前 DOM 为准
    const queue = [...original];
    try {
        for (let i = 0; i < queue.length; i++) {
            const section = queue[i];
            const all = Array.from(previewEl.querySelectorAll<HTMLElement>('.red-content-section'));
            showOnly(all, section);
            let overflow = measure(imagePreview, section);
            const imageBlock = section.classList.contains(IMAGE_ONLY_CLASS) ? null : findInlineImageBlock(section);
            const heading = section.firstElementChild && /^H[1-6]$/.test(section.firstElementChild.tagName) ? section.firstElementChild : null;
            if (overflow > 0 && imageBlock && hasTextBesidesImage(section, imageBlock, heading)) {
                const imageSection = splitImageOutOfSection(section, imageBlock);
                result.split.push(original.indexOf(section));
                queue.splice(i + 1, 0, imageSection);
                showOnly(Array.from(previewEl.querySelectorAll<HTMLElement>('.red-content-section')), section);
                overflow = measure(imagePreview, section);
            }
            if (overflow > 0) section.setAttribute(OVERFLOW_ATTR, String(Math.round(overflow)));
        }
    } finally {
        const all = Array.from(previewEl.querySelectorAll<HTMLElement>('.red-content-section'));
        for (const section of all) section.classList.remove(VISIBLE_CLASS, HIDDEN_CLASS);
        all.forEach((section, index) => { if (section.hasAttribute(OVERFLOW_ATTR)) result.overflowing.push(index); });
    }
    return result;
}

/** data-red-overflow 像素 → 大约几行，给提示文案用 */
export function overflowLines(section: Element | null): number {
    const px = Number(section?.getAttribute(OVERFLOW_ATTR) || 0);
    return px > 0 ? Math.max(1, Math.ceil(px / LINE_HEIGHT_PX)) : 0;
}

/** 收集溢出页号（从 1 起），供导出前提示 */
export function listOverflowingPages(root: ParentNode): number[] {
    return Array.from(root.querySelectorAll('.red-content-section'))
        .map((section, index) => (section.hasAttribute(OVERFLOW_ATTR) ? index + 1 : 0))
        .filter((n) => n > 0);
}
