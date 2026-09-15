// __mocks__/obsidian.js
//
// Extra over the bare-minimum stub:
// - Setting: chainable and DOM-backed (settingEl / nameEl / descEl / controlEl
//   are real elements appended to the container). Every setName(...) is
//   recorded into __obsidianSettingNamesRegistry, every add* control into
//   __obsidianControlRegistry (with settingName / key / changeHandler so tests
//   can drive onChange), every addButton into __obsidianButtonRegistry.
// - PluginSettingTab: implements the Obsidian 1.13+ declarative rendering —
//   display()/update() walk getSettingDefinitions(): control / action / render /
//   empty rows, group / list (heading, emptyState, addItem, onDelete) and page
//   entries (recorded; `renderPage(name)` instantiates the page factory and
//   displays it into its own containerEl for tests).
// - SettingPage: minimal 1.13 sub-page base (rootEl / titlebarEl / containerEl /
//   title / hide).
// - Modal: provides an obsidian-like contentEl/titleEl/modalEl that already
//   has the Obsidian DOM extension methods, matching sync_modal_ui.test.js
//   pattern.
// - createFragment: installed as a globalThis fallback because input.js
//   references it as a bare global (Obsidian runtime injects it).

if (!globalThis.__obsidianSettingNamesRegistry) {
  globalThis.__obsidianSettingNamesRegistry = [];
}
if (!globalThis.__obsidianButtonRegistry) {
  globalThis.__obsidianButtonRegistry = [];
}
if (!globalThis.__obsidianControlRegistry) {
  globalThis.__obsidianControlRegistry = [];
}
if (!globalThis.__obsidianModalRegistry) {
  globalThis.__obsidianModalRegistry = [];
}
if (!globalThis.__obsidianNoticeRegistry) {
  globalThis.__obsidianNoticeRegistry = [];
}

// Sentinel exposed on globalThis so tests can assert that the resolver patch
// is wired up correctly: `expect(globalThis.__obsidianMockLoaded).toBe(true)`.
globalThis.__obsidianMockLoaded = true;

function applyExtensions(el) {
  if (el.__obsidianExtensionsApplied) return el;
  el.__obsidianExtensionsApplied = true;
  el.empty = function empty() {
    while (this.firstChild) this.removeChild(this.firstChild);
  };
  el.addClass = function addClass(cls) {
    if (cls) this.classList.add(cls);
    return this;
  };
  el.removeClass = function removeClass(cls) {
    if (cls) this.classList.remove(cls);
    return this;
  };
  el.toggleClass = function toggleClass(cls, force) {
    if (cls) this.classList.toggle(cls, force);
    return this;
  };
  el.setText = function setText(text) {
    this.textContent = text == null ? '' : String(text);
  };
  el.appendText = function appendText(text) {
    this.appendChild(document.createTextNode(text == null ? '' : String(text)));
  };
  el.setCssStyles = function setCssStyles(styles = {}) {
    Object.entries(styles || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      this.style[key] = String(value);
    });
    return this;
  };
  el.createEl = function createEl(tag, opts = {}, callback) {
    const child = applyExtensions(document.createElement(tag));
    if (opts && typeof opts === 'object') {
      if (opts.cls) child.className = opts.cls;
      if (opts.text !== undefined) child.textContent = opts.text;
      if (opts.value !== undefined && 'value' in child) child.value = opts.value;
      if (opts.href && 'href' in child) child.href = opts.href;
      if (opts.attr && typeof opts.attr === 'object') {
        Object.entries(opts.attr).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          child.setAttribute(key, String(value));
        });
      }
    }
    this.appendChild(child);
    if (typeof callback === 'function') callback(child);
    return child;
  };
  el.createDiv = function createDiv(opts = {}, callback) {
    return this.createEl('div', opts, callback);
  };
  el.createSpan = function createSpan(opts = {}, callback) {
    return this.createEl('span', opts, callback);
  };
  el.createSvg = function createSvg(tag, opts = {}, callback) {
    const child = applyExtensions(document.createElementNS('http://www.w3.org/2000/svg', tag));
    if (opts && typeof opts === 'object') {
      if (opts.cls) child.setAttribute('class', opts.cls);
      if (opts.attr && typeof opts.attr === 'object') {
        Object.entries(opts.attr).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          child.setAttribute(key, String(value));
        });
      }
    }
    this.appendChild(child);
    if (typeof callback === 'function') callback(child);
    return child;
  };
  return el;
}

/**
 * ButtonComponent 替身。传入 buttonEl 时与真实 <button> 绑定：
 * setButtonText 同步 textContent，onClick 同步 onclick，setDisabled 同步 disabled。
 */
function makeButtonMock(buttonEl) {
  const button = {
    buttonEl: buttonEl || null,
    text: '',
    disabled: false,
    clickHandler: null,
    setButtonText(value) {
      this.text = String(value || '');
      if (this.buttonEl) this.buttonEl.textContent = this.text;
      return this;
    },
    setDisabled(value) {
      this.disabled = value === true;
      if (this.buttonEl) this.buttonEl.disabled = this.disabled;
      return this;
    },
    onClick(handler) {
      this.clickHandler = handler;
      if (this.buttonEl) this.buttonEl.onclick = () => handler();
      return this;
    },
    setWarning() {
      this.warning = true;
      return this;
    },
    setDestructive() {
      this.destructive = true;
      return this;
    },
    setCta() { return this; },
    setTooltip() { return this; },
    setIcon() { return this; },
    setClass() { return this; },
    then: undefined,
  };
  globalThis.__obsidianButtonRegistry.push(button);
  return button;
}

/**
 * toggle / text / textarea / dropdown / slider / color 等值控件替身：
 * 记录 value / changeHandler / options，inputEl 是真实 <input>/<select>
 * （feishu-tab 会写 inputEl.type = 'password'）。未知方法一律返回可继续链式
 * 调用的替身，保持与旧 chain proxy 相同的容错度。
 */
function makeControlMock(kind) {
  const inputEl = applyExtensions(document.createElement(kind === 'dropdown' ? 'select' : 'input'));
  const base = {
    kind,
    inputEl,
    selectEl: inputEl,
    toggleEl: inputEl,
    sliderEl: inputEl,
    settingName: null,
    key: null,
    value: undefined,
    changeHandler: null,
    options: {},
    placeholder: '',
    disabled: false,
    validationMessage: null,
    setValue(value) { this.value = value; return this; },
    getValue() { return this.value; },
    onChange(handler) { this.changeHandler = handler; return this; },
    setPlaceholder(value) { this.placeholder = String(value ?? ''); return this; },
    addOption(value, label) { this.options[value] = label; return this; },
    addOptions(options) { Object.assign(this.options, options || {}); return this; },
    setLimits() { return this; },
    setDynamicTooltip() { return this; },
    setDisabled(value) { this.disabled = value === true; return this; },
    setTooltip() { return this; },
    setInstant() { return this; },
    then: undefined,
  };
  const proxy = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'then' || typeof prop === 'symbol') return undefined;
      return () => proxy;
    },
  });
  globalThis.__obsidianControlRegistry.push(proxy);
  return proxy;
}

class SettingMock {
  constructor(containerEl) {
    this.containerEl = containerEl;
    this.settingEl = applyExtensions(document.createElement('div'));
    this.settingEl.className = 'setting-item';
    this.infoEl = this.settingEl.createDiv({ cls: 'setting-item-info' });
    this.nameEl = this.infoEl.createDiv({ cls: 'setting-item-name' });
    this.descEl = this.infoEl.createDiv({ cls: 'setting-item-description' });
    this.controlEl = this.settingEl.createDiv({ cls: 'setting-item-control' });
    if (containerEl && typeof containerEl.appendChild === 'function') {
      containerEl.appendChild(this.settingEl);
    }
    this.name = '';
  }
  setName(name) {
    if (typeof name === 'string') {
      globalThis.__obsidianSettingNamesRegistry.push(name);
      this.name = name;
      this.nameEl.textContent = name;
    } else if (name && typeof name === 'object' && 'textContent' in name) {
      this.name = String(name.textContent || '');
      this.nameEl.textContent = this.name;
    }
    return this;
  }
  setDesc(desc) {
    if (typeof desc === 'string') {
      this.descEl.textContent = desc;
    } else if (desc && typeof desc === 'object' && typeof desc.appendChild === 'function') {
      this.descEl.empty();
      this.descEl.appendChild(desc);
    }
    return this;
  }
  setHeading() { this.settingEl.addClass('setting-item-heading'); return this; }
  setClass(cls) { this.settingEl.addClass(cls); return this; }
  setTooltip() { return this; }
  setDisabled(value) { this.settingEl.toggleClass('is-disabled', value === true); return this; }
  addControl(kind, cb) {
    const control = makeControlMock(kind);
    control.settingName = this.name;
    this.controlEl.appendChild(control.inputEl);
    if (cb) cb(control);
    return this;
  }
  addToggle(cb) { return this.addControl('toggle', cb); }
  addText(cb) { return this.addControl('text', cb); }
  addTextArea(cb) { return this.addControl('textarea', cb); }
  addDropdown(cb) { return this.addControl('dropdown', cb); }
  addSlider(cb) { return this.addControl('slider', cb); }
  addColorPicker(cb) { return this.addControl('color', cb); }
  addSearch(cb) { return this.addControl('search', cb); }
  addButton(cb) {
    const buttonEl = this.controlEl.createEl('button');
    const button = makeButtonMock(buttonEl);
    if (cb) cb(button);
    return this;
  }
  addExtraButton(cb) {
    const buttonEl = this.controlEl.createEl('button', { cls: 'clickable-icon' });
    const button = makeButtonMock(buttonEl);
    if (cb) cb(button);
    return this;
  }
  then(cb) { if (cb) cb(this); return this; }
}

class ModalMock {
  constructor(app) {
    this.app = app;
    this.titleEl = applyExtensions(document.createElement('h2'));
    this.contentEl = applyExtensions(document.createElement('div'));
    this.modalEl = applyExtensions(document.createElement('div'));
    globalThis.__obsidianModalRegistry.push(this);
  }
  open() { this.isOpen = true; }
  close() {
    const wasOpen = this.isOpen;
    this.isOpen = false;
    if (wasOpen && typeof this.onClose === 'function') {
      this.onClose();
    }
  }
  onOpen() {}
  onClose() {}
}

// ---------------------------------------------------------------------------
// Obsidian 1.13+ 声明式 Settings：SettingPage + PluginSettingTab 渲染器
// ---------------------------------------------------------------------------

class SettingPageMock {
  constructor() {
    this.rootEl = applyExtensions(document.createElement('div'));
    this.rootEl.className = 'setting-page';
    this.titlebarEl = this.rootEl.createDiv({ cls: 'setting-page-titlebar' });
    this.containerEl = this.rootEl.createDiv({ cls: 'setting-page-content' });
    this.title = '';
  }
  display() {
    throw new Error('SettingPage 子类必须实现 display()');
  }
  hide() {
    this.containerEl.empty();
  }
}

function evaluateFlag(flag, fallback) {
  if (flag === undefined) return fallback;
  return typeof flag === 'function' ? flag() !== false : flag !== false;
}

function textOf(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'textContent' in value) return String(value.textContent || '');
  return '';
}

function renderControlDefinition(tab, setting, def) {
  const control = def.control;
  const stored = tab.getControlValue(control.key);
  const value = stored === undefined || stored === null ? control.defaultValue : stored;
  const bind = (component) => {
    component.key = control.key;
    component.settingName = def.name;
    component.controlType = control.type;
    component.setValue(value);
    component.onChange(async (next) => {
      if (typeof control.validate === 'function') {
        const message = await control.validate(next);
        component.validationMessage = message || null;
        if (message) return undefined;
      }
      return tab.setControlValue(control.key, next);
    });
    if (control.placeholder) component.setPlaceholder(control.placeholder);
    component.setDisabled(evaluateFlag(control.disabled, false) === true && control.disabled !== undefined
      ? (typeof control.disabled === 'function' ? control.disabled() === true : control.disabled === true)
      : false);
  };
  switch (control.type) {
    case 'toggle':
      setting.addToggle(bind);
      break;
    case 'text':
    case 'number':
    case 'file':
    case 'folder':
      setting.addText(bind);
      break;
    case 'textarea':
      setting.addTextArea(bind);
      break;
    case 'dropdown':
      setting.addDropdown((dropdown) => {
        dropdown.addOptions(control.options || {});
        bind(dropdown);
      });
      break;
    case 'slider':
      setting.addSlider(bind);
      break;
    case 'color':
      setting.addColorPicker(bind);
      break;
    default:
      throw new Error(`obsidian mock 不支持的 control 类型：${String(control.type)}`);
  }
}

function renderDefinitionRow(tab, containerEl, def, index, list) {
  if (!evaluateFlag(def.visible, true)) return;
  const setting = new SettingMock(containerEl).setName(def.name);
  if (def.desc !== undefined) setting.setDesc(def.desc);
  tab.renderedRows.push({ def, settingEl: setting.settingEl, setting });

  if (def.control) {
    renderControlDefinition(tab, setting, def);
  } else if (typeof def.action === 'function') {
    setting.settingEl.addClass('mod-clickable');
    if (typeof def.disabled !== 'undefined') {
      setting.setDisabled(typeof def.disabled === 'function' ? def.disabled() === true : def.disabled === true);
    }
    setting.addButton((button) => button
      .setButtonText(def.name)
      .onClick(() => def.action(setting.settingEl, index)));
  } else if (typeof def.render === 'function') {
    const cleanup = def.render(setting, { containerEl, listEl: containerEl });
    if (typeof cleanup === 'function') tab.renderCleanups.push(cleanup);
  }

  if (list && typeof list.onDelete === 'function') {
    const deleteEl = setting.controlEl.createEl('button', { text: '删除', cls: 'setting-list-delete' });
    deleteEl.onclick = () => list.onDelete(index);
  }
}

function renderGroupDefinition(tab, containerEl, group) {
  if (!evaluateFlag(group.visible, true)) return;
  const isList = group.type === 'list';
  const groupEl = containerEl.createDiv({
    cls: `setting-group${isList ? ' setting-list' : ''}${group.cls ? ` ${group.cls}` : ''}`,
  });
  if (group.heading) {
    new SettingMock(groupEl).setName(group.heading).setHeading();
  }
  if (isList && group.addItem) {
    const addEl = groupEl.createEl('button', { text: `+ ${group.addItem.name}`, cls: 'setting-list-add' });
    addEl.onclick = () => group.addItem.action(addEl);
  }
  const items = Array.isArray(group.items) ? group.items : [];
  if (isList && items.length === 0 && group.emptyState) {
    groupEl.createEl('p', { text: textOf(group.emptyState), cls: 'setting-list-empty' });
  }
  items.forEach((item, index) => renderDefinitionItem(tab, groupEl, item, index, isList ? group : null));
}

function renderDefinitionItem(tab, containerEl, item, index, list) {
  if (!item || typeof item !== 'object') {
    throw new Error(`obsidian mock: 非法的 setting 定义（index ${index}）`);
  }
  if (item.type === 'group' || item.type === 'list') {
    renderGroupDefinition(tab, containerEl, item);
    return;
  }
  if (item.type === 'page') {
    if (!evaluateFlag(item.visible, true)) return;
    const setting = new SettingMock(containerEl).setName(item.name).setClass('setting-page-link');
    if (item.desc !== undefined) setting.setDesc(item.desc);
    tab.pageDefinitions.push({ def: item, settingEl: setting.settingEl });
    return;
  }
  renderDefinitionRow(tab, containerEl, item, index, list);
}

class PluginSettingTabMock {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = applyExtensions(document.createElement('div'));
    this.settingItems = [];
    this.pageDefinitions = [];
    this.renderedRows = [];
    this.renderCleanups = [];
    this.renderedPages = [];
  }
  getSettingDefinitions() { return []; }
  getControlValue(key) {
    return this.plugin && this.plugin.settings ? this.plugin.settings[key] : undefined;
  }
  setControlValue(key, value) {
    this.plugin.settings[key] = value;
  }
  update() {
    this.renderCleanups.forEach((cleanup) => cleanup());
    this.renderCleanups = [];
    this.pageDefinitions = [];
    this.renderedRows = [];
    this.settingItems = this.getSettingDefinitions();
    this.containerEl.empty();
    this.settingItems.forEach((item, index) => renderDefinitionItem(this, this.containerEl, item, index, null));
  }
  display() { this.update(); }
  hide() { this.containerEl.empty(); }
  refreshDomState() {
    this.renderedRows.forEach(({ def, settingEl }) => {
      settingEl.toggleClass('is-hidden', !evaluateFlag(def.visible, true));
    });
  }
  /**
   * 测试辅助：找到名为 name 的 page 定义，实例化其 page() 并 display()。
   * 返回 SettingPage 实例（内容在 page.containerEl）。
   */
  renderPage(name) {
    const entry = this.pageDefinitions.find((item) => item.def.name === name);
    if (!entry) throw new Error(`obsidian mock: 未找到名为「${name}」的 page 定义（请先 update()）`);
    if (typeof entry.def.page !== 'function') {
      if (!Array.isArray(entry.def.items)) {
        throw new Error(`obsidian mock: page「${name}」既无 page 工厂也无 items`);
      }
      // 声明式子页面：把 items 按顶层同一套规则渲染进一个 SettingPage 容器
      const page = new SettingPageMock();
      page.title = name;
      page.definitions = entry.def.items;
      page.display = () => {
        page.containerEl.empty();
        entry.def.items.forEach((item, index) => renderDefinitionItem(this, page.containerEl, item, index, null));
      };
      page.display();
      this.renderedPages.push(page);
      return page;
    }
    const page = entry.def.page();
    if (!page.title) page.title = name;
    page.display();
    this.renderedPages.push(page);
    return page;
  }
}

// createFragment is referenced as a runtime global in input.js (Obsidian
// injects it). Polyfill once when the mock is required.
if (typeof globalThis.createFragment !== 'function') {
  globalThis.createFragment = (cb) => {
    const frag = applyExtensions(document.createElement('div'));
    if (typeof cb === 'function') cb(frag);
    return frag;
  };
}

module.exports = {
  Plugin: class {},
  // NOTE: Intentionally NOT exporting Platform. input.js's isMobileClient()
  // checks `Platform?.isMobile` first and only falls back to `app.isMobile`
  // if Platform is undefined. Tests like sync_modal_ui / view_parity rely
  // on the fallback to drive mobile-mode behavior via the fake `view.app`.
  ItemView: class {
    constructor() {
      this.containerEl = applyExtensions(document.createElement('div'));
    }
  },
  Notice: class {
    constructor(message = '', duration = 0) {
      this.message = message;
      this.duration = duration;
      globalThis.__obsidianNoticeRegistry.push({ message, duration, instance: this });
    }
    setMessage(message) { this.message = message; }
    hide() { this.hidden = true; }
  },
  MarkdownView: class {},
  MarkdownRenderer: {
    async renderMarkdown(markdown, el) {
      const safe = String(markdown || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      el.innerHTML = `<p>${safe}</p>`;
    },
  },
  PluginSettingTab: PluginSettingTabMock,
  SettingPage: SettingPageMock,
  Setting: SettingMock,
  Modal: ModalMock,
  requestUrl: async () => ({ json: {}, status: 200, headers: {} }),
  request: async () => '',
  setIcon: () => {},
  __applyExtensions: applyExtensions,
};
