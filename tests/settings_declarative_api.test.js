// tests/settings_declarative_api.test.js
//
// 3.10.0 设置面板迁移到 Obsidian 1.13 声明式 Settings API 的行为守卫：
//   - getControlValue / setControlValue 支持点路径与虚拟 key（AI 超时按秒）
//   - setControlValue 保留原 onChange 副作用（重启提示 / AI 工具栏联动 / 依赖重绘）
//   - 代理地址 validate 拒绝非 https，且不持久化
//   - 账号 / AI Provider 列表：点击编辑、+ 添加、行尾删除（经确认弹窗）
//   - 飞书 / 其他平台 子页面 display()/hide() 与 refreshSettingTabCompat 的精确重绘

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { createObsidianLikeElement } = require('./helpers/obsidian-dom.js');
const { loadInputModule } = require('./helpers/input-module.cjs');
const { AppleStyleSettingTab } = loadInputModule();
const { MULTI_PLATFORM_TAB_LABEL, MAX_ACCOUNTS } = await import('../services/settings-defaults.js');
const { AI_REQUEST_TIMEOUT_SECONDS_KEY } = await import('../views/settings/apple-style-setting-tab.js');
const { refreshSettingTabCompat } = await import('../services/obsidian-adapters.js');
const { createDefaultFeishuSyncSettings } = await import('../services/feishu-settings.js');

// 设置项的 action / onDelete 回调是 fire-and-forget（内部 void 一个 async 方法），
// 测试用一个宏任务等待其 await 链（确认弹窗 → saveSettings → update）跑完
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeSettings(overrides = {}) {
  return {
    avatarUrl: '',
    avatarBase64: '',
    enableWatermark: false,
    usePhoneFrame: true,
    wechatAccounts: [],
    defaultAccountId: '',
    proxyUrl: '',
    clientId: 'client-1',
    titlePolishEnabled: true,
    titlePolishModel: 'deepseek-v4-pro',
    feishuSync: createDefaultFeishuSyncSettings(),
    multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: 'token',
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'untested', checkedAt: 0, platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    },
    ai: {
      enabled: false,
      providers: [],
      defaultProviderId: '',
      layoutModel: 'deepseek-v4-pro',
      defaultLayoutFamily: 'auto',
      defaultColorPalette: 'auto',
      includeImagesInLayout: true,
      requestTimeoutMs: 45000,
      articleLayoutsByPath: {},
    },
    ...overrides,
  };
}

function makePlugin(settingsOverrides = {}) {
  const view = { updateAiToolbarState: vi.fn(), refreshAiLayoutPanel: vi.fn() };
  return {
    app: {},
    view,
    manifest: { dir: '/test', id: 'note-content-studio', version: '0.0.0-test' },
    settings: makeSettings(settingsOverrides),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    openExternalUrl: vi.fn(() => true),
    startWechatSyncBridgeInBackground: vi.fn(),
    _wechatSyncBridgeService: null,
    getWechatSyncBridgeService: vi.fn(() => ({})),
    getConverterView: vi.fn(() => view),
    getArticleLayoutState: vi.fn(() => null),
  };
}

function makeAccount(id, name) {
  return { id, name, appId: `wx${id}00000000`, appSecret: 'secret', author: '' };
}

function makeProvider(id, name, overrides = {}) {
  return {
    id,
    name,
    kind: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'secret',
    model: 'gpt-test',
    enabled: true,
    ...overrides,
  };
}

function renderTab(plugin) {
  const tab = new AppleStyleSettingTab(plugin.app, plugin);
  tab.containerEl = createObsidianLikeElement('div');
  tab.update();
  // 3.11.4 起普通设置项都在「样式 / 分发 / AI」三组的声明式子页面里：
  // 顶层只渲染页面入口，这里顺手打开三个声明式子页面，让 control / button 注册表包含它们
  for (const name of ['公众号排版', '微信公众号', 'AI Provider 与编排']) tab.renderPage(name);
  return tab;
}

// 递归展开 group / list / 声明式 page 的 items
function flattenDefinitions(items) {
  return items.flatMap((item) => {
    if (item.type === 'group' || item.type === 'list') return [item, ...flattenDefinitions(item.items || [])];
    if (item.type === 'page' && Array.isArray(item.items)) return [item, ...flattenDefinitions(item.items)];
    return [item];
  });
}

function findDefinition(tab, name) {
  return flattenDefinitions(tab.getSettingDefinitions()).find((item) => item.name === name && item.type !== 'page');
}

// 声明式子页面的内容容器（renderTab 已打开三个子页面）
function pageEl(tab, name) {
  const page = tab.renderedPages.find((item) => item.title === name);
  if (!page) throw new Error(`子页面未渲染：${name}`);
  return page.containerEl;
}

function findControl(settingName) {
  return globalThis.__obsidianControlRegistry.find((control) => control.settingName === settingName);
}

function findButton(text) {
  return globalThis.__obsidianButtonRegistry.find((button) => button.text === text);
}

function findList(tab, heading) {
  return flattenDefinitions(tab.getSettingDefinitions()).find((item) => item.type === 'list' && item.heading === heading);
}

describe('AppleStyleSettingTab - 声明式 control 读写', () => {
  beforeEach(() => {
    globalThis.__obsidianSettingNamesRegistry = [];
    globalThis.__obsidianButtonRegistry = [];
    globalThis.__obsidianControlRegistry = [];
    globalThis.__obsidianModalRegistry = [];
    globalThis.__obsidianNoticeRegistry = [];
  });

  it('every control key resolves through getControlValue (dot paths included)', () => {
    const plugin = makePlugin({ ai: { ...makeSettings().ai, enabled: true, defaultLayoutFamily: 'auto' } });
    const tab = renderTab(plugin);
    const controls = flattenDefinitions(tab.getSettingDefinitions()).filter((item) => item.control && item.type !== 'page');
    expect(controls.length).toBeGreaterThan(8);
    for (const def of controls) {
      const value = tab.getControlValue(def.control.key);
      expect(value === undefined || value === null ? def.control.defaultValue : value).not.toBeUndefined();
    }
    expect(tab.getControlValue('ai.enabled')).toBe(true);
    expect(tab.getControlValue('usePhoneFrame')).toBe(true);
    expect(tab.getControlValue(AI_REQUEST_TIMEOUT_SECONDS_KEY)).toBe(45);
  });

  it('setControlValue writes dot paths, persists and refreshes the open converter for ai.* keys', async () => {
    const plugin = makePlugin();
    const tab = renderTab(plugin);

    await tab.setControlValue('ai.enabled', true);

    expect(plugin.settings.ai.enabled).toBe(true);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
    expect(plugin.view.updateAiToolbarState).toHaveBeenCalledTimes(1);
    expect(plugin.view.refreshAiLayoutPanel).toHaveBeenCalledTimes(1);
  });

  it('throws instead of silently creating missing intermediate objects', async () => {
    const plugin = makePlugin();
    const tab = renderTab(plugin);
    await expect(tab.setControlValue('nonexistent.child', 1)).rejects.toThrow('设置路径不存在');
    expect(plugin.saveSettings).not.toHaveBeenCalled();
  });

  it('maps the AI timeout between seconds (UI) and milliseconds (storage) with clamping', async () => {
    const plugin = makePlugin();
    const tab = renderTab(plugin);

    await tab.setControlValue(AI_REQUEST_TIMEOUT_SECONDS_KEY, 30);
    expect(plugin.settings.ai.requestTimeoutMs).toBe(30000);
    await tab.setControlValue(AI_REQUEST_TIMEOUT_SECONDS_KEY, 999);
    expect(plugin.settings.ai.requestTimeoutMs).toBe(180000);
    await tab.setControlValue(AI_REQUEST_TIMEOUT_SECONDS_KEY, 1);
    expect(plugin.settings.ai.requestTimeoutMs).toBe(5000);
    await tab.setControlValue(AI_REQUEST_TIMEOUT_SECONDS_KEY, 0);
    expect(plugin.settings.ai.requestTimeoutMs).toBe(120000);
    expect(tab.getControlValue(AI_REQUEST_TIMEOUT_SECONDS_KEY)).toBe(120);
  });

  it('toggling 使用手机仿真框 through the rendered control persists and shows the restart notice', async () => {
    const plugin = makePlugin();
    renderTab(plugin);
    const toggle = findControl('使用手机仿真框');
    expect(toggle).toBeDefined();
    expect(toggle.value).toBe(true);

    await toggle.changeHandler(false);

    expect(plugin.settings.usePhoneFrame).toBe(false);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
    expect(globalThis.__obsidianNoticeRegistry.at(-1).message).toContain('重新打开发布助手面板');
  });

  it('trims the proxy url and rejects non-https values through validate without persisting', async () => {
    const plugin = makePlugin();
    const tab = renderTab(plugin);
    const proxyDef = findDefinition(tab, 'API 代理地址');
    expect(proxyDef.control.key).toBe('proxyUrl');
    expect(proxyDef.control.validate('http://insecure.example.com')).toContain('HTTPS');
    expect(proxyDef.control.validate('https://ok.example.com')).toBeUndefined();
    expect(proxyDef.control.validate('')).toBeUndefined();

    const proxyControl = findControl('API 代理地址');
    await proxyControl.changeHandler('http://insecure.example.com');
    expect(proxyControl.validationMessage).toContain('HTTPS');
    expect(plugin.settings.proxyUrl).toBe('');
    expect(plugin.saveSettings).not.toHaveBeenCalled();

    await proxyControl.changeHandler('  https://ok.example.com  ');
    expect(plugin.settings.proxyUrl).toBe('https://ok.example.com');
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('测试代理 is an action row that refuses to run without a proxy url', async () => {
    const plugin = makePlugin();
    renderTab(plugin);
    const testButton = findButton('测试代理');
    expect(testButton).toBeDefined();
    await testButton.clickHandler();
    expect(globalThis.__obsidianNoticeRegistry.at(-1).message).toBe('请先填写 API 代理地址');
  });
});

describe('AppleStyleSettingTab - 账号 / AI Provider 列表', () => {
  beforeEach(() => {
    globalThis.__obsidianSettingNamesRegistry = [];
    globalThis.__obsidianButtonRegistry = [];
    globalThis.__obsidianControlRegistry = [];
    globalThis.__obsidianModalRegistry = [];
    globalThis.__obsidianNoticeRegistry = [];
  });

  it('renders accounts as list items whose action opens the edit modal; the default account is a dropdown', () => {
    const plugin = makePlugin({
      wechatAccounts: [makeAccount('a1', '公众号 A'), makeAccount('a2', '公众号 B')],
      defaultAccountId: 'a2',
    });
    const tab = renderTab(plugin);
    const list = findList(tab, '账号列表');
    expect(list.items.map((item) => item.name)).toEqual(['公众号 A', '公众号 B（默认）']);

    const defaultDropdown = findControl('默认账号');
    expect(defaultDropdown).toBeDefined();
    expect(defaultDropdown.options).toEqual({ a1: '公众号 A', a2: '公众号 B' });
    expect(defaultDropdown.value).toBe('a2');

    list.items[0].action(null, 0);
    const modal = globalThis.__obsidianModalRegistry.at(-1);
    expect(modal.titleEl.textContent).toBe('编辑账号');
    expect(modal.contentEl.querySelector('input').value).toBe('公众号 A');
  });

  it('hides the default-account dropdown when there are no accounts and shows the list empty state', () => {
    const tab = renderTab(makePlugin());
    expect(findControl('默认账号')).toBeUndefined();
    expect(findDefinition(tab, '默认账号').visible()).toBe(false);
    expect(pageEl(tab, '微信公众号').textContent).toContain('暂无账号');
  });

  it('addItem opens the add-account modal, and refuses beyond MAX_ACCOUNTS', () => {
    const tab = renderTab(makePlugin());
    findList(tab, '账号列表').addItem.action(null);
    expect(globalThis.__obsidianModalRegistry.at(-1).titleEl.textContent).toBe('添加账号');

    const full = makePlugin({
      wechatAccounts: Array.from({ length: MAX_ACCOUNTS }, (_, i) => makeAccount(`acc${i}`, `账号 ${i}`)),
      defaultAccountId: 'acc0',
    });
    const fullTab = renderTab(full);
    const modalsBefore = globalThis.__obsidianModalRegistry.length;
    findList(fullTab, '账号列表').addItem.action(null);
    expect(globalThis.__obsidianModalRegistry.length).toBe(modalsBefore);
    expect(globalThis.__obsidianNoticeRegistry.at(-1).message).toContain('最大账号数量');
  });

  it('onDelete removes the account after confirmation and re-points the default account', async () => {
    const plugin = makePlugin({
      wechatAccounts: [makeAccount('a1', '公众号 A'), makeAccount('a2', '公众号 B')],
      defaultAccountId: 'a1',
    });
    const tab = renderTab(plugin);
    const deleteButtons = Array.from(pageEl(tab, '微信公众号').querySelectorAll('button'))
      .filter((button) => button.textContent === '删除');
    expect(deleteButtons).toHaveLength(2);

    deleteButtons[0].onclick();
    const modal = globalThis.__obsidianModalRegistry.at(-1);
    expect(modal.titleEl.textContent).toBe('删除公众号账号');
    Array.from(modal.contentEl.querySelectorAll('button')).find((button) => button.textContent === '删除').click();
    await flushPromises();

    expect(plugin.settings.wechatAccounts.map((account) => account.id)).toEqual(['a2']);
    expect(plugin.settings.defaultAccountId).toBe('a2');
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('changing 默认 AI Provider through the dropdown persists, refreshes the converter and re-renders', async () => {
    const plugin = makePlugin({
      ai: {
        ...makeSettings().ai,
        providers: [makeProvider('p1', 'Provider 1'), makeProvider('p2', 'Provider 2', { enabled: false })],
        defaultProviderId: 'p1',
      },
    });
    const tab = renderTab(plugin);
    expect(findList(tab, 'AI Provider 列表').items.map((item) => item.name)).toEqual(['Provider 1（默认）', 'Provider 2']);
    const dropdown = findControl('默认 AI Provider');
    expect(Object.keys(dropdown.options)).toEqual(['', 'p1', 'p2']);

    await dropdown.changeHandler('p2');

    expect(plugin.settings.ai.defaultProviderId).toBe('p2');
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
    expect(plugin.view.updateAiToolbarState).toHaveBeenCalled();
    expect(findList(tab, 'AI Provider 列表').items.map((item) => item.name)).toEqual(['Provider 1', 'Provider 2（默认）']);
    expect(findList(tab, 'AI Provider 列表').items[1].desc).toContain('已停用');
  });

  it('AI provider list items open the edit modal and the add affordance opens the add modal', () => {
    const plugin = makePlugin({ ai: { ...makeSettings().ai, providers: [makeProvider('p1', 'Provider 1')], defaultProviderId: 'p1' } });
    const tab = renderTab(plugin);
    const list = findList(tab, 'AI Provider 列表');
    list.items[0].action(null, 0);
    expect(globalThis.__obsidianModalRegistry.at(-1).titleEl.textContent).toBe('编辑 AI Provider');
    list.addItem.action(null);
    expect(globalThis.__obsidianModalRegistry.at(-1).titleEl.textContent).toBe('添加 AI Provider');
  });
});

describe('AppleStyleSettingTab - 子页面', () => {
  beforeEach(() => {
    globalThis.__obsidianSettingNamesRegistry = [];
    globalThis.__obsidianButtonRegistry = [];
    globalThis.__obsidianControlRegistry = [];
    globalThis.__obsidianModalRegistry = [];
    globalThis.__obsidianNoticeRegistry = [];
  });

  it('飞书 page renders the existing Feishu settings into its own containerEl and tracks itself on the tab', () => {
    const tab = renderTab(makePlugin());
    const page = tab.renderPage('飞书');
    expect(page.title).toBe('飞书');
    expect(tab.activeSettingPage).toBe(page);
    expect(page.containerEl.textContent).toContain('飞书云文档同步配置');
    expect(page.containerEl.querySelector('.apple-settings-tab-intro')?.textContent).toContain('配置飞书自建应用');
    expect(globalThis.__obsidianSettingNamesRegistry).toContain('启用飞书同步功能');

    page.hide();
    expect(tab.activeSettingPage).toBeNull();
    expect(page.containerEl.childNodes).toHaveLength(0);
  });

  it('其他平台 page renders the existing multi-platform settings', () => {
    const tab = renderTab(makePlugin());
    const page = tab.renderPage(MULTI_PLATFORM_TAB_LABEL);
    expect(page.title).toBe(MULTI_PLATFORM_TAB_LABEL);
    expect(globalThis.__obsidianSettingNamesRegistry).toContain('启用浏览器插件发布');
    expect(page.containerEl.querySelector('.wechat-multiplatform-token-status')).not.toBeNull();
  });

  it('refreshSettingTabCompat redraws the open sub-page, otherwise calls update()', () => {
    const tab = renderTab(makePlugin());
    const updateSpy = vi.spyOn(tab, 'update');

    expect(refreshSettingTabCompat(tab)).toBe(true);
    expect(updateSpy).toHaveBeenCalledTimes(1);

    const page = tab.renderPage(MULTI_PLATFORM_TAB_LABEL);
    const displaySpy = vi.spyOn(page, 'display');
    expect(refreshSettingTabCompat(tab)).toBe(true);
    expect(displaySpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledTimes(1);

    expect(refreshSettingTabCompat(null)).toBe(false);
    expect(refreshSettingTabCompat({})).toBe(false);
  });

  it('小红书图卡 page lazy-loads RedSettingsPanel into its container', async () => {
    const plugin = makePlugin();
    const tab = renderTab(plugin);
    const page = tab.renderPage('小红书图卡');
    expect(page.title).toBe('小红书图卡');
    expect(page.loadPromise).toBeInstanceOf(Promise);
    await page.loadPromise;
    // 不再重复渲染上游的「Note to RED 设置」标题，直接是分区
    expect(page.containerEl.textContent).not.toContain('Note to RED');
    expect(page.containerEl.textContent).toContain('基本设置');
  });
});
