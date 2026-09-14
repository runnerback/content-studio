// 小红书图卡「是否显示页眉」开关（2026-09-14）：与 showFooter 对称；替代此前用 CSS 片段 display:none 硬藏的做法。
// 覆盖：默认显示页眉/页脚；showHeader=false 移除 .red-preview-header；showFooter=false 移除 .red-preview-footer。
import { describe, it, expect } from 'vitest';
import { MarkdownRenderer } from 'obsidian';

function patchGlobalDom() {
  const proto = globalThis.HTMLElement.prototype;
  const define = (name, fn) => {
    if (!proto[name]) Object.defineProperty(proto, name, { configurable: true, value: fn });
  };
  define('empty', function () { while (this.firstChild) this.removeChild(this.firstChild); });
  define('addClass', function (c) { if (c) this.classList.add(c); return this; });
  define('removeClass', function (c) { if (c) this.classList.remove(c); return this; });
  define('setText', function (t) { this.textContent = t == null ? '' : String(t); });
  define('createEl', function (tag, opts = {}) {
    const child = document.createElement(tag);
    if (opts.cls) child.className = opts.cls;
    if (opts.text !== undefined) child.textContent = opts.text;
    if (opts.type) child.type = opts.type;
    if (opts.value !== undefined && 'value' in child) child.value = opts.value;
    if (opts.attr) Object.entries(opts.attr).forEach(([k, v]) => child.setAttribute(k, String(v)));
    this.appendChild(child);
    return child;
  });
  define('createDiv', function (opts = {}) { return this.createEl('div', opts); });
  define('createSpan', function (opts = {}) { return this.createEl('span', opts); });
}

async function mountWith(rednoteSettings) {
  patchGlobalDom();
  MarkdownRenderer.render = async (_app, _content, el) => {
    el.innerHTML = '<h2>卡一</h2><p>内容</p>';
  };
  const fakeFile = { path: 'a.md', extension: 'md' };
  const app = {
    workspace: { on: () => ({}), getActiveFile: () => fakeFile },
    vault: { on: () => ({}), cachedRead: async () => '## 卡一\n内容' },
    metadataCache: { getFirstLinkpathDest: () => null },
  };
  const hostPlugin = { settings: { rednote: rednoteSettings }, saveSettings: async () => {} };
  const { createRednoteManagers } = await import('../rednote/index.ts');
  const managers = await createRednoteManagers(app, hostPlugin);
  const { RedPreviewController } = await import('../rednote/view.ts');
  const host = { registerEvent: () => {}, register: () => {}, addChild(c) { return c; } };
  const controller = new RedPreviewController(app, host, managers.themeManager, managers.settingsManager);
  const container = document.createElement('div');
  document.body.appendChild(container);
  await controller.mount(container);
  await controller.onFileOpen(fakeFile);
  return { container, controller };
}

describe('小红书图卡 页眉/页脚 显示开关', () => {
  it('默认（未设置）同时显示页眉和页脚', async () => {
    const { container: el } = await mountWith({});
    expect(el.querySelector('.red-preview-header')).not.toBeNull();
    expect(el.querySelector('.red-preview-footer')).not.toBeNull();
  });

  it('showHeader=false 移除页眉；页脚不受影响', async () => {
    const { container: el } = await mountWith({ showHeader: false });
    expect(el.querySelector('.red-preview-header')).toBeNull();
    expect(el.querySelector('.red-preview-footer')).not.toBeNull();
  });

  it('showHeader=false 且 showFooter=false 两者都移除（等价于原 CSS 片段效果）', async () => {
    const { container: el } = await mountWith({ showHeader: false, showFooter: false });
    expect(el.querySelector('.red-preview-header')).toBeNull();
    expect(el.querySelector('.red-preview-footer')).toBeNull();
  });

  it('面板开关走 controller.setShowHeader/setShowFooter：改后立即重渲染', async () => {
    const { container: el, controller } = await mountWith({});
    await controller.setShowHeader(false);
    expect(el.querySelector('.red-preview-header')).toBeNull();
    expect(el.querySelector('.red-preview-footer')).not.toBeNull();
    await controller.setShowFooter(false);
    expect(el.querySelector('.red-preview-footer')).toBeNull();
    await controller.setShowHeader(true);
    expect(el.querySelector('.red-preview-header')).not.toBeNull();
  });
});
