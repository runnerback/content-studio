// views/clipboard/clipboard-export.js
//
// 复制到公众号 / 剪贴板导出：富文本写入剪贴板、复制按钮图标与加载态、公众号发布前的
// HTML 增强（mermaid / 公式栅格化 + 代码块变换）、代码块变换（剪贴板与 wechatsync 两种目标），
// 从 AppleStyleView god-class 抽出为 prototype mixin（Object.assign 到 view 原型），
// 方法内 `this` 用法保持不变。

import { obsidianApi, getActiveDocumentCompat, getObsidianSetIcon, isMobileClient } from '../../services/obsidian-adapters.js';
import { createHtmlContainer, htmlToText, setElementHtml } from '../../services/dom-utils.js';
import { toText } from '../../services/input-utils.js';
import { convertRenderedMermaidDiagramsToImages } from '../../services/rendered-mermaid.js';
import { convertMathContainersToImages } from '../../services/math-export.js';

const { Notice } = obsidianApi;

/** @typedef {import('../../input.js').AppleStyleViewInstance} AppleStyleViewInstance */
/** @satisfies {ThisType<AppleStyleViewInstance>} */
export const clipboardExportMixin = {
  /**
   * @param {string} htmlContent
   * @returns {Promise<boolean>}
   */
  async copyRichHTMLByClipboard(htmlContent) {
    if (
      !navigator.clipboard ||
      typeof navigator.clipboard.write !== 'function' ||
      typeof ClipboardItem === 'undefined'
    ) {
      return false;
    }

    const item = new ClipboardItem({
      'text/html': new Blob([htmlContent], { type: 'text/html' }),
    });
    await navigator.clipboard.write([item]);
    return true;
  },

  /**
   * @param {unknown} text
   * @returns {string}
   */
  normalizeClipboardText(text) {
    return toText(text).replace(/\s+/g, ' ').trim();
  },

  /**
   * @param {string} icon
   */
  setCopyButtonIcon(icon) {
    if (!this.copyBtn) return;
    this.copyBtn.replaceChildren();
    const setIcon = getObsidianSetIcon();
    if (typeof setIcon === 'function') {
      setIcon(this.copyBtn, icon);
    }
  },

  setCopyButtonSpinner() {
    if (!this.copyBtn) return;
    this.copyBtn.replaceChildren();
    const activeDocument = getActiveDocumentCompat();
    if (!activeDocument) return;
    const spinner = activeDocument.createElement('span');
    spinner.className = 'apple-copy-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    this.copyBtn.appendChild(spinner);
  },

  /**
   * @param {HTMLElement | null} root
   * @returns {Promise<void>}
   */
  async enhanceHtmlForWechatPublishing(root) {
    if (!root) return;
    const activeDocument = getActiveDocumentCompat();
    /** @type {HTMLElement | null} */
    let mount = null;
    try {
      if (activeDocument?.body && !root.isConnected) {
        mount = activeDocument.createElement('div');
        mount.setCssStyles({
          position: 'fixed',
          left: '-99999px',
          top: '0',
          width: '760px',
          opacity: '0',
          pointerEvents: 'none',
          overflow: 'hidden',
        });
        activeDocument.body.appendChild(mount);
        mount.appendChild(root);
      }
      await convertRenderedMermaidDiagramsToImages(root, {
        simpleHash: (value) => this.simpleHash(String(value || '')),
        mermaidImageCache: this.mermaidImageCache,
      });
      // 3.12.0：Obsidian 自带 MathJax 的 CHTML 公式，公众号编辑器不认 mjx-* 元素，复制前栅格化成图片
      await convertMathContainersToImages(root, {
        cache: this.mathImageCache,
        simpleHash: (value) => this.simpleHash(String(value || '')),
      });
      this.transformCodeBlocksForClipboard(root);
    } finally {
      if (mount) {
        mount.remove();
      }
    }
  },

  /**
   * @param {Element | null | undefined} block
   * @returns {string}
   */
  extractCodeTextForWechatsync(block) {
    const codePre = block?.querySelector?.('pre');
    if (!codePre) return '';

    const sectionNodes = /** @type {HTMLElement[]} */ (Array.from(codePre.querySelectorAll('section')));
    const codeLinesNode = sectionNodes
      .filter((node) => {
        const style = (node.getAttribute('style') || '').toLowerCase();
        return style.includes('white-space:nowrap') || style.includes('white-space: nowrap');
      })
      .sort((a, b) => {
        /** @param {HTMLElement} node */
        const score = (node) => {
          const html = node.innerHTML || '';
          return (html.includes('<br') ? 10000 : 0) + (node.textContent || '').length;
        };
        return score(b) - score(a);
      })[0];

    if (codeLinesNode) {
      return (codeLinesNode.innerHTML || '')
        .split(/<br\s*\/?>/i)
        .map((lineHtml) => {
          return htmlToText(lineHtml || '').replace(/\u00a0/g, ' ');
        })
        .join('\n');
    }

    const codeEl = codePre.querySelector('code');
    return ((codeEl ? codeEl.textContent : codePre.textContent) || '').replace(/\u00a0/g, ' ');
  },

  /**
   * @param {Element | null} root
   */
  transformCodeBlocksForWechatsync(root) {
    if (!root) return;

    const codeBlocks = /** @type {HTMLElement[]} */ (Array.from(root.querySelectorAll('.code-snippet__fix')));
    codeBlocks.forEach((block) => {
      const codeText = this.extractCodeTextForWechatsync(block);

      const activeDocument = getActiveDocumentCompat();
      if (!activeDocument) return;
      const pre = activeDocument.createElement('pre');
      pre.setAttribute('style', [
        'display:block !important',
        'width:100% !important',
        'max-width:100% !important',
        'margin:14px 0 !important',
        'padding:12px 14px !important',
        'box-sizing:border-box !important',
        'background:#f6f8fa !important',
        'border:1px solid #e5e7eb !important',
        'border-radius:8px !important',
        'overflow-x:auto !important',
        'overflow-y:hidden !important',
        '-webkit-overflow-scrolling:touch !important',
        "font-family:'SF Mono',Consolas,Monaco,monospace !important",
        'font-size:13px !important',
        'line-height:1.65 !important',
        'color:#24292f !important',
        'text-indent:0 !important',
        'white-space:pre !important',
      ].join(';'));

      const code = activeDocument.createElement('code');
      code.setAttribute('style', [
        'display:block !important',
        'margin:0 !important',
        'padding:0 !important',
        'background:transparent !important',
        'color:#24292f !important',
        'font:inherit !important',
        'line-height:inherit !important',
        'white-space:pre !important',
        'text-indent:0 !important',
      ].join(';'));
      code.textContent = codeText;
      pre.appendChild(code);
      block.replaceWith(pre);
    });
  },

  /**
   * @param {Element | null} root
   * @returns {void}
   */
  transformCodeBlocksForClipboard(root) {
    if (!root) return;

    const codeBlocks = /** @type {HTMLElement[]} */ (Array.from(root.querySelectorAll('.code-snippet__fix')));
    codeBlocks.forEach((block) => {
      const codePre = block.querySelector('pre');
      if (!codePre) return;

      const codeHtml = codePre.innerHTML || '';
      const styleText = block.getAttribute('style') || '';
      const backgroundMatch = styleText.match(/background:([^;!]+)(?:\s*!important)?/i);
      const borderMatch = styleText.match(/border:([^;!]+)(?:\s*!important)?/i);
      const radiusMatch = styleText.match(/border-radius:([^;!]+)(?:\s*!important)?/i);
      const background = backgroundMatch ? backgroundMatch[1].trim() : '#0d1117';
      const border = borderMatch ? borderMatch[1].trim() : '1px solid #30363d';
      const borderRadius = radiusMatch ? radiusMatch[1].trim() : '8px';
      const sectionNodes = /** @type {HTMLElement[]} */ (Array.from(codePre.querySelectorAll('section')));
      const lineNumberColumn = sectionNodes.find((node) => {
        const style = (node.getAttribute('style') || '').toLowerCase();
        return style.includes('border-right') && style.includes('user-select');
      });
      const codeLinesNode = sectionNodes
        .filter((node) => {
          const style = (node.getAttribute('style') || '').toLowerCase();
          return style.includes('white-space:nowrap') || style.includes('white-space: nowrap');
        })
        .sort((a, b) => {
          /** @param {HTMLElement} node */
          const score = (node) => {
            const html = node.innerHTML || '';
            return (html.includes('<br') ? 10000 : 0) + (node.textContent || '').length;
          };
          return score(b) - score(a);
        })[0];
      const codeLinesHtml = codeLinesNode ? codeLinesNode.innerHTML : codeHtml;
      const directMacHeader = Array.from(block.children).find((child) =>
        child !== codePre &&
        !child.querySelector('pre') &&
        child.querySelector('span') &&
        !(child.textContent || '').trim()
      );
      const hasMacHeader = !!directMacHeader;
      const codeLineParts = codeLinesNode
        ? codeLinesHtml.split(/<br\s*\/?>/i)
        : [codeLinesHtml];
      const lineNumberLabels = lineNumberColumn
        ? Array.from(lineNumberColumn.children).map((node) => (node.textContent || '').trim()).filter(Boolean)
        : [];
      const shouldKeepFixedLineNumbers = lineNumberLabels.length > 0 && codeLineParts.length > 0;

      const activeDocument = getActiveDocumentCompat();
      if (!activeDocument) return;
      const pre = activeDocument.createElement('pre');
      pre.setAttribute('class', 'hljs code__pre');
      pre.setAttribute('style', `width:100% !important;max-width:100% !important;margin:12px 0 !important;background:${background} !important;border:${border} !important;border-radius:${borderRadius} !important;box-shadow:0 4px 12px rgba(0,0,0,0.3) !important;overflow-x:auto !important;overflow-y:hidden !important;-webkit-overflow-scrolling:touch !important;box-sizing:border-box !important;font-family:'SF Mono',Consolas,Monaco,monospace !important;font-size:13px !important;line-height:1.75 !important;color:#f0f6fc !important;white-space:normal !important;`);

      if (hasMacHeader) {
        const toolbar = activeDocument.createElement('section');
        const toolbarStyle = 'display:block !important;background:#161b22 !important;padding:6px 10px 6px 10px !important;border:none !important;border-bottom:1px solid #30363d !important;border-radius:8px 8px 0 0 !important;line-height:1 !important;box-sizing:border-box !important;width:100% !important;';
        toolbar.setAttribute('style', toolbarStyle);
        setElementHtml(toolbar, [
        '<span style="display:inline-block !important;width:9px !important;height:9px !important;border-radius:50% !important;background:#ff5f57 !important;margin-right:7px !important;font-size:0 !important;line-height:0 !important;color:transparent !important;vertical-align:top !important;">&nbsp;</span>',
        '<span style="display:inline-block !important;width:9px !important;height:9px !important;border-radius:50% !important;background:#ffbd2e !important;margin-right:7px !important;font-size:0 !important;line-height:0 !important;color:transparent !important;vertical-align:top !important;">&nbsp;</span>',
        '<span style="display:inline-block !important;width:9px !important;height:9px !important;border-radius:50% !important;background:#28c840 !important;font-size:0 !important;line-height:0 !important;color:transparent !important;vertical-align:top !important;">&nbsp;</span>',
      ].join(''));
        pre.appendChild(toolbar);
      }

      const code = activeDocument.createElement('code');
      if (shouldKeepFixedLineNumbers) {
        const lineNumbersHtml = codeLineParts.map((_, index) => {
          const lineNumber = lineNumberLabels[index] || String(index + 1);
          return `<section style="padding:0 10px 0 0 !important;line-height:1.75 !important;color:#95989C !important;">${lineNumber}</section>`;
        }).join('');
        const codeInnerHtml = codeLineParts.map((lineHtml) => lineHtml || '&nbsp;').join('<br/>');
        const codeWithLineNumbersStyle = 'display:block !important;width:100% !important;min-width:100% !important;max-width:100% !important;padding:0 !important;box-sizing:border-box !important;background:transparent !important;color:#f0f6fc !important;font-family:inherit !important;font-size:13px !important;line-height:1.75 !important;white-space:normal !important;overflow:visible !important;text-indent:0 !important;margin:0 !important;';
        code.setAttribute('style', codeWithLineNumbersStyle);
        setElementHtml(code, `<section style="display:flex !important;align-items:flex-start !important;overflow-x:hidden !important;overflow-y:visible !important;width:100% !important;max-width:100% !important;padding:0 !important;box-sizing:border-box !important;margin:0 !important;">
          <section class="line-numbers" style="text-align:right !important;padding:12px 0 !important;border-right:1px solid rgba(255,255,255,0.1) !important;user-select:none !important;background:transparent !important;flex:0 0 auto !important;min-width:3.5em !important;box-sizing:border-box !important;margin:0 !important;">${lineNumbersHtml}</section>
          <section class="code-scroll" style="flex:1 1 auto !important;overflow-x:auto !important;overflow-y:visible !important;-webkit-overflow-scrolling:touch !important;padding:12px 12px 12px 16px !important;min-width:0 !important;box-sizing:border-box !important;margin:0 !important;">
            <section style="white-space:pre !important;min-width:max-content !important;line-height:1.75 !important;font-size:13px !important;margin:0 !important;">${codeInnerHtml}</section>
          </section>
        </section>`);
      } else {
        const codeScrollableStyle = 'display:block !important;width:max-content !important;min-width:100% !important;max-width:none !important;padding:12px !important;box-sizing:border-box !important;background:transparent !important;color:#f0f6fc !important;font-family:inherit !important;font-size:13px !important;line-height:1.75 !important;white-space:nowrap !important;overflow:visible !important;text-indent:0 !important;margin:0 !important;';
        code.setAttribute('style', codeScrollableStyle);
        setElementHtml(code, codeLinesHtml);
      }
      pre.appendChild(code);

      block.replaceWith(pre);
    });
  },

  /**
   * @returns {Promise<{ supported: boolean, text: string }>}
   */
  async readClipboardTextSnapshot() {
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
      return { supported: false, text: '' };
    }
    try {
      const text = await navigator.clipboard.readText();
      return { supported: true, text: this.normalizeClipboardText(text) };
    } catch {
      return { supported: false, text: '' };
    }
  },


  /**
   * 复制 HTML
   * @returns {Promise<void>}
   */
  async copyHTML() {
    if (this.isCopying) return;

    if (!this.currentHtml) {
      new Notice(this.getMissingRenderNotice());
      return;
    }

    this.isCopying = true;
    if (this.copyBtn) {
      this.copyBtn.classList.add('is-copying');
      this.setCopyButtonSpinner();
    }

    try {
      const exportHtml = this.getCurrentExportHtml() || this.currentHtml;
      // 创建临时的 DOM 容器来解析和处理图片
      const tempDiv = createHtmlContainer('div', exportHtml);

      // 处理本地图片：转换为 JPEG Base64
      // 返回 true 表示有图片被处理了
      await this.processImagesToDataURL(tempDiv);

      await this.enhanceHtmlForWechatPublishing(tempDiv);

      // 清理 HTML 以适配微信编辑器（处理嵌套列表等）
      const cleanedHtml = this.cleanHtmlForDraft(tempDiv.innerHTML);

      const htmlContent = cleanedHtml;
      window.__OWC_LAST_CLIPBOARD_HTML = htmlContent;
      window.__OWC_LAST_CLIPBOARD_TEXT = htmlToText(cleanedHtml);
      const expectedPlainText = this.normalizeClipboardText(window.__OWC_LAST_CLIPBOARD_TEXT);

      const mobile = isMobileClient(this.app);
      let copied = false;
      try {
        copied = await this.copyRichHTMLByClipboard(htmlContent);
      } catch {
        copied = false;
      }
      if (mobile && copied) {
        const snapshot = await this.readClipboardTextSnapshot();
        copied = snapshot.supported && snapshot.text === expectedPlainText;
      }

      if (!copied) {
        throw new Error('rich copy unavailable');
      }

      // Success Feedback
      new Notice('✅ 已复制公众号格式，请直接粘贴到公众号编辑器');
      if (this.copyBtn) {
         this.copyBtn.classList.remove('is-copying');
         this.setCopyButtonIcon('check'); // 变成对勾图标
         window.setTimeout(() => {
           if (this.copyBtn) {
             this.setCopyButtonIcon('copy'); // 恢复复制图标
           }
         }, 2000);
      }
      return;

    } catch (error) {
      console.error('复制失败:', error);
      new Notice('❌ 复制失败，请使用「发布与分发」发送文章');
      if (this.copyBtn) {
        this.copyBtn.classList.remove('is-copying');
        this.setCopyButtonIcon('copy');
      }
    } finally {
      this.isCopying = false;
    }
  },
};
