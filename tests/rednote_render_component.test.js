// 回归：小红书预览渲染必须把「宿主视图 Component」传给 MarkdownRenderer.render（2026-09-11 事故）
// 背景：控制器本身不是 Obsidian Component；文案带图片嵌入时 Obsidian 会调 component.addChild()，
// 传 `this` 会 TypeError 中断渲染，切卡/套主题全跳过 → 预览排版崩成一排。
import { describe, it, expect, beforeAll } from 'vitest';
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

describe('小红书预览：MarkdownRenderer.render 的 component 参数', () => {
  let renderCalls;
  let host;
  let controller;

  beforeAll(async () => {
    patchGlobalDom();
    renderCalls = [];
    MarkdownRenderer.render = async (app, content, el, path, component) => {
      renderCalls.push({ path, component });
      // 模拟 Obsidian 渲染图片嵌入：会对 component 调 addChild（真实 Obsidian 的行为）
      if (typeof component?.addChild !== 'function') throw new TypeError('component.addChild is not a function');
      component.addChild({ load() {} });
      el.innerHTML = '<h2>卡一</h2><p>文字</p><h2>📸 实拍画面 1</h2><span class="internal-embed" src="x.jpg" alt="x"></span>';
    };
    const fakeFile = { path: '文案.md', extension: 'md' };
    const app = {
      workspace: { on: () => ({}), getActiveFile: () => fakeFile },
      vault: { on: () => ({}), cachedRead: async () => '## 卡一\n文字\n## 📸 实拍画面 1\n![](x.jpg)' },
      metadataCache: { getFirstLinkpathDest: () => null },
    };
    const hostPlugin = { settings: {}, saveSettings: async () => {} };
    const { createRednoteManagers } = await import('../rednote/index.ts');
    const managers = await createRednoteManagers(app, hostPlugin);
    const { RedPreviewController } = await import('../rednote/view.ts');
    // 宿主视图：真实场景是 ItemView（Component 子类），这里给带 addChild 的替身并记录调用
    host = { registerEvent: () => {}, register: () => {}, children: [], addChild(c) { this.children.push(c); return c; } };
    controller = new RedPreviewController(app, host, managers.themeManager, managers.settingsManager);
    const container = document.createElement('div');
    document.body.appendChild(container);
    await controller.mount(container);
    await controller.onFileOpen(fakeFile);
  });

  it('传给 render 的 component 是宿主视图对象，而不是控制器自身', () => {
    expect(renderCalls.length).toBeGreaterThan(0);
    for (const call of renderCalls) {
      expect(call.component).toBe(host);
      expect(call.component).not.toBe(controller);
    }
  });

  it('带图片嵌入的文案渲染不抛错，且嵌入子组件挂到了宿主上', () => {
    expect(host.children.length).toBeGreaterThan(0);
  });
});
