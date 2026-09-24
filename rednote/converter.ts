import { App, setIcon } from 'obsidian';
import type { RednoteHost as RedPlugin } from './host.ts';

export class RedConverter {
    private static app: App;
    private static plugin: RedPlugin;

    static initialize(app: App, plugin: RedPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    static hasValidContent(element: HTMLElement): boolean {
        const settings = this.plugin?.settingsManager?.getSettings();
        const headingLevel = settings?.headingLevel || 'h1';
        const headers = element.querySelectorAll(headingLevel);
        return headers.length > 0;
    }

    static formatContent(element: HTMLElement): void {
        const settings = this.plugin?.settingsManager?.getSettings();
        const headingLevel = settings?.headingLevel || 'h1';
        const headers = Array.from(element.querySelectorAll(headingLevel));
        
        if (headers.length === 0) {
            element.empty();
            element.createDiv({
                cls: 'red-empty-message',
                text: `⚠️ 温馨提示
                        请使用${headingLevel === 'h1' ? '一级标题(#)' : '二级标题(##)'}来分割内容
                        每个${headingLevel === 'h1' ? '一级标题' : '二级标题'}将生成一张独立的图片
                        现在编辑文档，实时预览效果`
            });
            // 触发自定义事件
            element.dispatchEvent(new CustomEvent('content-validation-change', { 
                detail: { isValid: false },
                bubbles: true 
            }));
            return;
        }

        // 触发自定义事件表示内容有效
        element.dispatchEvent(new CustomEvent('content-validation-change', { 
            detail: { isValid: true },
            bubbles: true 
        }));

        // 创建预览容器
        const previewContainer = createDiv();
        previewContainer.className = 'red-preview-container';

        // 创建图片预览区域
        const imagePreview = createDiv();
        imagePreview.className = 'red-image-preview';
        
        // 创建复制按钮
        const copyButton = createEl('button');
        copyButton.className = 'red-copy-button';
        setIcon(copyButton, 'copy');
        copyButton.title = '复制图片';
        copyButton.setAttribute('aria-label', '复制图片到剪贴板');
        
        // 添加复制按钮到预览容器
        previewContainer.appendChild(copyButton);

        // 创建三个主要区域
        const headerArea = createDiv();
        headerArea.className = 'red-preview-header';

        const contentArea = createDiv();
        contentArea.className = 'red-preview-content';

        const footerArea = createDiv();
        footerArea.className = 'red-preview-footer';

        // 创建内容容器
        const contentContainer = createDiv();
        contentContainer.className = 'red-content-container';
        
        // 处理每个二级标题及其内容
        headers.forEach((header, index) => {
            const section = this.createContentSection(header, index);
            if (section) {
                contentContainer.appendChild(section);
            }
        });

        // 组装结构
        contentArea.appendChild(contentContainer);
        imagePreview.appendChild(headerArea);
        imagePreview.appendChild(contentArea);
        imagePreview.appendChild(footerArea);
        previewContainer.appendChild(imagePreview);

        // 处理完成后再清空原容器并添加新内容
        element.empty();
        element.appendChild(previewContainer);

        // 触发自定义事件，通知 view 添加复制按钮事件监听
        const copyEvent = new CustomEvent('copy-button-added', { 
            detail: { copyButton },
            bubbles: true 
        });
        element.dispatchEvent(copyEvent);
    }

        private static createContentSection(header: Element, index: number): HTMLElement | null {
        const settings = this.plugin?.settingsManager?.getSettings();
        const headingLevel = settings?.headingLevel || 'h1';
        
        // 获取当前标题到下一个标题之间的所有内容
        const content: Element[] = [];
        let current = header.nextElementSibling;
        
        while (current && current.tagName !== headingLevel.toUpperCase()) {
            content.push(current.cloneNode(true) as Element);
            current = current.nextElementSibling;
        }

        // 检查内容中是否有水平分割线
        const pages: Element[][] = [[]];
        let currentPage = 0;
        
        content.forEach((el: Element) => {
            // 检查是否为水平分割线
            if (el.tagName === 'HR') {
                // 创建新页面
                currentPage++;
                pages[currentPage] = [];
            } else {
                // 如果当前页面数组不存在，创建一个
                if (!pages[currentPage]) {
                    pages[currentPage] = [];
                }
                // 添加元素到当前页面
                pages[currentPage].push(el);
            }
        });
        
        // 如果只有一个页面，按原来的方式处理
        if (pages.length === 1 && !content.some(el => el.tagName === 'HR')) {
            // 创建内容区域
            const section = createEl('section');
            section.className = 'red-content-section';
            section.setAttribute('data-index', index.toString());
            
            // 添加标题
            section.appendChild(header.cloneNode(true));
            
            // 添加内容
            content.forEach(el => section.appendChild(el));
            
            // 处理样式和格式
            this.processElements(section);
            
            return section;
        } else {
            // 创建一个包含多个页面的片段
            const fragment = createFragment();
            
            // 为每个页面创建一个部分
            pages.forEach((pageContent, pageIndex) => {
                if (pageContent.length === 0) return; // 跳过空页面
                
                const section = createEl('section');
                section.className = 'red-content-section';
                section.setAttribute('data-index', `${index}-${pageIndex}`);
                
                // 每个页面都添加标题
                section.appendChild(header.cloneNode(true));
                
                // 添加页面内容
                pageContent.forEach(el => section.appendChild(el));
                
                // 处理样式和格式
                this.processElements(section);
                
                fragment.appendChild(section);
            });
            
            return fragment as unknown as HTMLElement;
        }
    }

    private static processElements(container: HTMLElement | null): void {
        if (!container) return;

        // 处理强调文本
        container.querySelectorAll('strong, em').forEach(el => {
            el.classList.add('red-emphasis');
        });

        // 处理链接
        container.querySelectorAll('a').forEach(el => {
            el.classList.add('red-link');
        });

        // 处理表格
        container.querySelectorAll('table').forEach(el => {
            if (el === container.closest('table')) return;
            el.classList.add('red-table');
        });

        // 处理分割线
        container.querySelectorAll('hr').forEach(el => {
            el.classList.add('red-hr');
        });

        // 处理删除线
        container.querySelectorAll('del').forEach(el => {
            el.classList.add('red-del');
        });

        // 处理任务列表
        container.querySelectorAll('.task-list-item').forEach(el => {
            el.classList.add('red-task-list-item');
        });

        // 处理脚注
        container.querySelectorAll('.footnote-ref, .footnote-backref').forEach(el => {
            el.classList.add('red-footnote');
        });

        // 处理代码块
        container.querySelectorAll('pre code').forEach(el => {
            const pre = el.parentElement;
            if (pre) {
                pre.classList.add('red-pre');
                
                // 添加 macOS 风格的窗口按钮
                const dots = createDiv();
                dots.className = 'red-code-dots';

                ['red', 'yellow', 'green'].forEach(color => {
                    const dot = createSpan();
                    dot.className = `red-code-dot red-code-dot-${color}`;
                    dots.appendChild(dot);
                });

                pre.insertBefore(dots, pre.firstChild);
                
                // 移除原有的复制按钮
                const copyButton = pre.querySelector('.copy-code-button');
                if (copyButton) {
                    copyButton.remove();
                }
            }
        });

        // 处理图片
        container.querySelectorAll('span.internal-embed[alt][src]').forEach(el => {
            const originalSpan = el as HTMLElement;
            const src = originalSpan.getAttribute('src');
            const alt = originalSpan.getAttribute('alt');
            
            if (!src) return;
            
            try {
                const linktext = src.split('|')[0];
                const file = this.app.metadataCache.getFirstLinkpathDest(linktext, '');
                if (file) {
                    const absolutePath = this.app.vault.adapter.getResourcePath(file.path);
                    const newImg = createEl('img');
                    newImg.src = absolutePath;
                    if (alt) newImg.alt = alt;
                    newImg.className = 'red-image';
                    originalSpan.parentNode?.replaceChild(newImg, originalSpan);
                }
            } catch (error) {
                console.error('图片处理失败:', error);
            }
        });

        // 处理引用块
        container.querySelectorAll('blockquote').forEach(el => {
            el.classList.add('red-blockquote');
            el.querySelectorAll('p').forEach(p => {
                p.classList.add('red-blockquote-p');
            });
        });
    }
}
