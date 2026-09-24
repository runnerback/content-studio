// tests/settings_ui_smoke.test.js
//
// Smoke test for AppleStyleSettingTab settings rendering. Goal: any future refactor
// that accidentally drops a Setting from the top-level (wechat) definitions or
// the「其他平台」sub-page will be caught here. This was motivated by commit
// d115abd silently dropping「使用系统回收站」and「API 代理地址」when refactoring
// 高级设置 — neither change had a test, so the regression went unnoticed.
//
// 3.10.0: the tab uses the Obsidian 1.13 declarative Settings API. Top-level
// content is rendered by the mock's PluginSettingTab.update() from
// getSettingDefinitions(); 飞书 / 其他平台 / 小红书 are `page` entries rendered
// on demand through the mock helper `tab.renderPage(name)`.
//
// Invariant: when the test fails, fix the SettingTab UI, not the test —
// unless the field has been intentionally retired.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { createObsidianLikeElement } = require('./helpers/obsidian-dom.js');
const { loadInputModule } = require('./helpers/input-module.cjs');
const { AppleStyleSettingTab } = loadInputModule();
const { MULTI_PLATFORM_TAB_LABEL } = await import('../services/settings-defaults.js');

// 设置项的 action / onDelete 回调是 fire-and-forget（内部 void 一个 async 方法），
// 测试用一个宏任务等待其 await 链（确认弹窗 → saveSettings → update）跑完
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function makeMinimalSettings(overrides = {}) {
  return {
    theme: 'github',
    themeColor: 'blue',
    customColor: '#0366d6',
    quoteCalloutStyleMode: 'theme',
    fontFamily: 'sans-serif',
    fontSize: 3,
    macCodeBlock: true,
    codeLineNumber: true,
    avatarUrl: '',
    avatarBase64: '',
    enableWatermark: false,
    showImageCaption: true,
    normalizeChinesePunctuation: true,
    wechatAccounts: [],
    defaultAccountId: '',
    proxyUrl: '',
    usePhoneFrame: true,
    sidePadding: 16,
    coloredHeader: false,
    cleanupAfterSync: false,
    cleanupUseSystemTrash: true,
    cleanupDirTemplate: '',
    multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: '',
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: {
        status: 'untested',
        checkedAt: 0,
        platforms: [],
        capabilities: {},
        message: '',
      },
      recentTasks: [],
    },
    wechatAppId: '',
    wechatAppSecret: '',
    ai: {
      enabled: false,
      providers: [],
      defaultProviderId: '',
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
  return {
    app: {},
    manifest: { dir: '/test', id: 'note-content-studio', version: '0.0.0-test' },
    settings: makeMinimalSettings(settingsOverrides),
    saveSettings: vi.fn().mockResolvedValue(undefined),
    openExternalUrl: vi.fn(() => true),
    startWechatSyncBridgeInBackground: vi.fn(),
    _wechatSyncBridgeService: null,
    getWechatSyncBridgeService: vi.fn(() => ({
      start: vi.fn().mockResolvedValue({}),
      waitForConnection: vi.fn().mockResolvedValue(undefined),
      health: vi.fn().mockResolvedValue({ ok: true, tokenValid: true }),
      quotaStatus: vi.fn().mockResolvedValue({ tier: 'free', license_state: 'none', license_expires_at: null, limit: 3, used: 0, remaining: 3, reset_at: '2026-09-15T16:00:00.000Z', upgrade_url: '' }),
      listSupportedPlatforms: vi.fn().mockResolvedValue([]),
      getAuthSnapshot: vi.fn().mockResolvedValue({ platforms: [], checkedAt: 0 }),
      checkAuth: vi.fn().mockResolvedValue([]),
      getStatus: vi.fn().mockResolvedValue({}),
    })),
    getConverterView: vi.fn(() => null),
    getArticleLayoutState: vi.fn(() => null),
  };
}

function makeTab(plugin) {
  const tab = new AppleStyleSettingTab(plugin.app, plugin);
  tab.containerEl = createObsidianLikeElement('div');
  return tab;
}

// 顶层（原「微信」tab 内容）：走 1.13 声明式渲染
function renderTab(plugin) {
  const tab = makeTab(plugin);
  tab.update();
  // 3.11.4 起普通设置项在声明式子页面里；打开三个子页面让注册表包含其中的项
  for (const name of ['公众号排版', '微信公众号', 'AI Provider 与编排']) tab.renderPage(name);
  return tab;
}

// 「其他平台」子页面：实例化 page 工厂并 display()，内容在 page.containerEl
function renderMultiPlatformPage(plugin) {
  const tab = renderTab(plugin);
  return tab.renderPage(MULTI_PLATFORM_TAB_LABEL);
}

// 声明式子页面的内容容器（renderTab 已打开三个子页面）
function pageEl(tab, name) {
  const page = tab.renderedPages.find((item) => item.title === name);
  if (!page) throw new Error(`子页面未渲染：${name}`);
  return page.containerEl;
}

function findButton(text) {
  return globalThis.__obsidianButtonRegistry.find((button) => button.text === text);
}

describe('AppleStyleSettingTab settings rendering - smoke test', () => {
  beforeEach(() => {
    globalThis.__obsidianSettingNamesRegistry = [];
    globalThis.__obsidianButtonRegistry = [];
    globalThis.__obsidianControlRegistry = [];
    globalThis.__obsidianModalRegistry = [];
    globalThis.__obsidianNoticeRegistry = [];
  });

  it('loads via the resolver patch (sanity check)', () => {
    expect(globalThis.__obsidianMockLoaded).toBe(true);
  });

  it('exposes a declarative settings definition tree for Obsidian 1.13+', () => {
    const plugin = makePlugin();
    const tab = makeTab(plugin);
    const definitions = tab.getSettingDefinitions();

    // 不再是单个 render 壳：顶层 = 说明行 + 三个分组
    expect(definitions.length).toBe(4);
    expect(definitions.some((item) => typeof item.render === 'function')).toBe(false);
    // 3.11.4：顶层 = 说明行 + 「样式设置 / 分发设置 / AI 设置」三组，组内全是子页面入口
    const groups = definitions.filter((item) => item.type === 'group');
    expect(definitions.filter((item) => item.type === 'list')).toEqual([]);
    expect(definitions.filter((item) => item.type === 'page')).toEqual([]);
    expect(groups.map((group) => group.heading)).toEqual(['样式设置', '分发设置', 'AI 设置']);
    const pagesByGroup = groups.map((group) => group.items.map((item) => `${item.type}:${item.name}`));
    expect(pagesByGroup).toEqual([
      ['page:公众号排版', 'page:小红书图卡'],
      ['page:微信公众号', 'page:飞书', `page:${MULTI_PLATFORM_TAB_LABEL}`],
      ['page:AI Provider 与编排'],
    ]);
    // 命令式子页面走 page 工厂；其余是声明式 items（含 group / list）
    const allPages = groups.flatMap((group) => group.items);
    const factoryPages = allPages.filter((page) => typeof page.page === 'function').map((page) => page.name);
    expect(factoryPages).toEqual(['小红书图卡', '飞书', MULTI_PLATFORM_TAB_LABEL]);
    allPages.filter((page) => typeof page.page !== 'function').forEach((page) => expect(Array.isArray(page.items)).toBe(true));
    const wechatPage = allPages.find((page) => page.name === '微信公众号');
    expect(wechatPage.items.map((item) => item.heading)).toEqual(['微信公众号账号', '账号列表', 'API 代理']);

    tab.update();
    expect(globalThis.__obsidianSettingNamesRegistry.length).toBeGreaterThan(5);
    // 手写 tab 栏已删除
    expect(tab.containerEl.querySelector('.apple-settings-tabs')).toBeNull();
    expect(tab.containerEl.querySelector('.apple-settings-tab')).toBeNull();
  });

  it('renders the top-level core sections without throwing', () => {
    const plugin = makePlugin();
    expect(() => renderTab(plugin)).not.toThrow();
    expect(globalThis.__obsidianSettingNamesRegistry.length).toBeGreaterThan(5);
  });

  it('renders the settings intro without the removed GitHub star banner', () => {
    const plugin = makePlugin();
    const tab = renderTab(plugin);

    // GitHub Star 提醒横幅已移除
    expect(tab.containerEl.querySelector('.apple-settings-github-banner')).toBeNull();
    expect(tab.containerEl.querySelector('.apple-settings-intro')).toBeNull();
    // 说明文字现在是顶层第一条（无控件的）定义
    const intro = tab.getSettingDefinitions()[0];
    expect(intro.control).toBeUndefined();
    expect(intro.action).toBeUndefined();
    expect(intro.desc).toContain('设置分三组');
    expect(intro.desc).not.toContain('不会改变');
    expect(tab.containerEl.textContent).toContain('设置分三组');
  });

  it('keeps API 代理 fields (原「高级设置」) that earlier refactors silently dropped', () => {
    // Regression guard for 代理字段。清理资源相关字段（自动清理/清理目录/回收站）
    // 已按需求刻意移除，此处只守护仍需保留的字段。3.11.4 起它们在「分发设置 → 微信公众号」页。
    renderTab(makePlugin());
    const names = globalThis.__obsidianSettingNamesRegistry;
    expect(names).not.toContain('高级设置');
    expect(names).toContain('API 代理');
    expect(names).toContain('API 代理地址');
    expect(names).toContain('测试代理');
    // 清理资源功能已移除，确认对应设置项确实不再出现
    expect(names).not.toContain('发送成功后自动清理资源');
    expect(names).not.toContain('清理目录');
  });

  it('renders the preview / watermark headings inside 样式设置 → 公众号排版', () => {
    renderTab(makePlugin());
    const names = globalThis.__obsidianSettingNamesRegistry;
    expect(names).toContain('预览模式');
    expect(names).toContain('使用手机仿真框');
    expect(names).toContain('图片水印');
    expect(names).toContain('启用图片水印');
    expect(names).toContain('头像 URL（备用）');
  });

  it('cancels AI Provider deletion through an Obsidian confirmation modal', async () => {
    const plugin = makePlugin({
      ai: {
        enabled: true,
        providers: [{
          id: 'provider-1',
          name: '测试 Provider',
          kind: 'openai-compatible',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'secret',
          model: 'gpt-test',
          enabled: true,
        }],
        defaultProviderId: 'provider-1',
        defaultLayoutFamily: 'auto',
        defaultColorPalette: 'auto',
        includeImagesInLayout: true,
        requestTimeoutMs: 45000,
        articleLayoutsByPath: {},
      },
    });
    const tab = renderTab(plugin);
    const deleteButton = Array.from(pageEl(tab, 'AI Provider 与编排').querySelectorAll('button'))
      .find((button) => button.textContent === '删除');
    expect(deleteButton).toBeDefined();

    deleteButton.onclick();
    const modal = globalThis.__obsidianModalRegistry.at(-1);
    expect(modal.titleEl.textContent).toBe('删除 AI Provider');
    modal.contentEl.querySelector('button').click();
    await flushPromises();

    expect(plugin.settings.ai.providers).toHaveLength(1);
    expect(plugin.saveSettings).not.toHaveBeenCalled();
  });

  it('confirms AI Provider deletion through an Obsidian confirmation modal', async () => {
    const plugin = makePlugin({
      ai: {
        enabled: true,
        providers: [{
          id: 'provider-1',
          name: '测试 Provider',
          kind: 'openai-compatible',
          baseUrl: 'https://api.example.com/v1',
          apiKey: 'secret',
          model: 'gpt-test',
          enabled: true,
        }],
        defaultProviderId: 'provider-1',
        defaultLayoutFamily: 'auto',
        defaultColorPalette: 'auto',
        includeImagesInLayout: true,
        requestTimeoutMs: 45000,
        articleLayoutsByPath: {},
      },
    });
    const tab = renderTab(plugin);
    const deleteButton = Array.from(pageEl(tab, 'AI Provider 与编排').querySelectorAll('button'))
      .find((button) => button.textContent === '删除');

    deleteButton.onclick();
    const modal = globalThis.__obsidianModalRegistry.at(-1);
    const confirmButton = Array.from(modal.contentEl.querySelectorAll('button'))
      .find((button) => button.textContent === '删除');
    confirmButton.click();
    await flushPromises();

    expect(plugin.settings.ai.providers).toEqual([]);
    expect(plugin.settings.ai.defaultProviderId).toBe('');
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('clears the AI layout cache only after confirmation through the action row', async () => {
    const plugin = makePlugin({
      ai: {
        enabled: true,
        providers: [],
        defaultProviderId: '',
        defaultLayoutFamily: 'auto',
        defaultColorPalette: 'auto',
        includeImagesInLayout: true,
        requestTimeoutMs: 45000,
        articleLayoutsByPath: {
          'notes/demo.md': {
            layoutJson: {
              articleType: 'tutorial',
              stylePack: 'tech-green',
              blocks: [{ type: 'lead-quote', text: 'hello' }],
            },
          },
        },
      },
    });
    renderTab(plugin);
    // 有缓存时才出现「清空」action；破坏性操作必须经确认弹窗
    const clearButton = findButton('清空 AI 编排缓存');
    expect(clearButton).toBeDefined();
    expect(globalThis.__obsidianSettingNamesRegistry).not.toContain('AI 编排缓存');

    clearButton.clickHandler();
    const modal = globalThis.__obsidianModalRegistry.at(-1);
    expect(modal.titleEl.textContent).toBe('清空 AI 编排缓存');
    expect(plugin.saveSettings).not.toHaveBeenCalled();
    const confirmButton = Array.from(modal.contentEl.querySelectorAll('button'))
      .find((button) => button.textContent === '清空');
    confirmButton.click();
    await flushPromises();

    expect(plugin.settings.ai.articleLayoutsByPath).toEqual({});
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('shows a read-only 「AI 编排缓存」row instead of the clear action when nothing is cached', () => {
    renderTab(makePlugin());
    const names = globalThis.__obsidianSettingNamesRegistry;
    expect(names).toContain('AI 编排缓存');
    expect(names).not.toContain('清空 AI 编排缓存');
    expect(findButton('清空 AI 编排缓存')).toBeUndefined();
  });

  it('offers 「清除本地头像」only when a local avatar exists and clears it on click', async () => {
    renderTab(makePlugin({ avatarBase64: '' }));
    expect(globalThis.__obsidianSettingNamesRegistry).not.toContain('清除本地头像');
    expect(findButton('清除本地头像')).toBeUndefined();

    globalThis.__obsidianSettingNamesRegistry = [];
    globalThis.__obsidianButtonRegistry = [];
    const plugin = makePlugin({ avatarBase64: 'data:image/png;base64,ZmFrZQ==' });
    renderTab(plugin);
    expect(globalThis.__obsidianSettingNamesRegistry).toContain('清除本地头像');
    const clearButton = findButton('清除本地头像');
    expect(clearButton).toBeDefined();

    clearButton.clickHandler();
    await flushPromises();

    expect(plugin.settings.avatarBase64).toBe('');
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
    expect(globalThis.__obsidianNoticeRegistry.at(-1).message).toBe('已清除本地头像');
    // 清除后重绘，action 随之消失
    expect(findButton('清除本地头像')?.buttonEl?.isConnected ?? false).toBe(false);
  });

  it('renders the multi-platform page core fields when bridge is enabled', () => {
    renderMultiPlatformPage(makePlugin({ multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: '',
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'untested', checkedAt: 0, platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    } }));
    const names = globalThis.__obsidianSettingNamesRegistry;
    expect(names).toContain('启用浏览器插件发布');
    expect(names).toContain('本地服务端口');
    expect(names).toContain('连接令牌');
    expect(names).toContain('测试连接');
    // 「读取已选平台状态」按钮已移除(冗余且依赖扩展不支持的 getAuthSnapshot);
    // 登录态检测已并入「测试连接」(逐个 checkAuth)。
    expect(names).not.toContain('读取已选平台状态');
  });

  it('does not expose hidden fallback-only platforms in the settings picker', () => {
    const page = renderMultiPlatformPage(makePlugin({ multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: 'token',
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'failed', checkedAt: 123, platforms: [], capabilities: {}, message: '浏览器插件连接失败' },
      recentTasks: [],
    } }));
    const platformIds = Array.from(page.containerEl.querySelectorAll('.wechat-platform-chip input'))
      .map((input) => input.value);

    expect(platformIds).not.toContain('wordpress');
    expect(platformIds).not.toContain('typecho');
    expect(platformIds).not.toContain('zip-download');
  });

  it('测试连接连通后逐个 checkAuth 检测已接入平台(小红书/X)登录态', async () => {
    const authByPlatform = {
      xiaohongshu: { isAuthenticated: true, username: 'Lin' },
      x: { isAuthenticated: false, error: '未登录' },
    };
    const bridge = {
      start: vi.fn().mockResolvedValue({}),
      waitForConnection: vi.fn().mockResolvedValue(undefined),
      health: vi.fn().mockResolvedValue({ ok: true, tokenValid: true, capabilities: {} }),
      listSupportedPlatforms: vi.fn().mockResolvedValue([
        { id: 'xiaohongshu', name: '小红书' },
        { id: 'x', name: 'X' },
      ]),
      // 扩展支持单平台 checkAuth,不支持批量 getAuthSnapshot
      checkAuth: vi.fn().mockImplementation((id) => Promise.resolve(authByPlatform[id] || { isAuthenticated: false })),
      getStatus: vi.fn().mockResolvedValue({}),
    };
    const plugin = makePlugin({
      multiPlatformSync: {
        enabled: true,
        port: 9527,
        token: 'token',
        supportedPlatforms: [],
        selectedPlatforms: [],
        connection: {
          status: 'connected',
          checkedAt: 123,
          platforms: [],
          capabilities: {},
          message: '',
        },
        recentTasks: [],
      },
    });
    plugin.getWechatSyncBridgeService = vi.fn(() => bridge);

    renderMultiPlatformPage(plugin);
    const testButton = findButton('测试');
    expect(testButton).toBeDefined();

    await testButton.clickHandler();

    expect(bridge.health).toHaveBeenCalled();
    expect(bridge.listSupportedPlatforms).toHaveBeenCalled();
    // 逐个 checkAuth(小红书/X);被动检测不开标签页
    expect(bridge.checkAuth).toHaveBeenCalledWith('xiaohongshu', expect.anything());
    expect(bridge.checkAuth).toHaveBeenCalledWith('x', expect.anything());
    expect(bridge.getAuthSnapshot).toBeUndefined();
    const platforms = plugin.settings.multiPlatformSync.connection.platforms;
    expect(platforms.map((p) => p.id)).toEqual(['xiaohongshu', 'x']);
    expect(platforms.find((p) => p.id === 'xiaohongshu').authenticated).toBe(true);
    expect(platforms.find((p) => p.id === 'x').authenticated).toBe(false);
    expect(plugin.settings.multiPlatformSync.connection.message).toContain('已检测各发布平台的登录状态');
  });

  it('unified status bar shows 「连接失败」 and error message when connection.status is failed', () => {
    const page = renderMultiPlatformPage(makePlugin({ multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: 'abc',
      connectedClients: [],
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: {
        status: 'failed',
        checkedAt: Date.now(),
        platforms: [],
        capabilities: {},
        message: '连接令牌校验失败',
      },
      recentTasks: [],
    } }));

    const dot = page.containerEl.querySelector('.wechat-multiplatform-token-status-dot');
    expect(dot).not.toBeNull();
    expect(dot.classList.contains('is-error')).toBe(true);
    expect(dot.textContent).toBe('连接失败');
    const body = page.containerEl.querySelector('.wechat-bridge-status-body');
    expect(body.textContent).toContain('连接令牌校验失败');

    // Unified bar must come before the platform picker.
    const unifiedBar = page.containerEl.querySelector('.wechat-multiplatform-token-status');
    const picker = page.containerEl.querySelector('.wechat-platform-picker');
    expect(picker).not.toBeNull();
    expect(unifiedBar.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not render the unified status bar or platform section when bridge is disabled', () => {
    const page = renderMultiPlatformPage(makePlugin({ multiPlatformSync: {
      enabled: false,
      port: 9527,
      token: '',
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'untested', checkedAt: 0, platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    } }));
    expect(page.containerEl.querySelector('.wechat-multiplatform-token-status')).toBeNull();
    expect(page.containerEl.querySelector('.wechat-platform-picker')).toBeNull();
  });

  it('hides bridge-config fields and diagnostics when bridge is disabled', () => {
    renderMultiPlatformPage(makePlugin({ multiPlatformSync: {
      enabled: false,
      port: 9527,
      token: '',
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'untested', checkedAt: 0, platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    } }));
    const names = globalThis.__obsidianSettingNamesRegistry;
    expect(names).toContain('启用浏览器插件发布');
    expect(names).not.toContain('本地服务端口');
    expect(names).not.toContain('测试连接');
    expect(names).not.toContain('读取已选平台状态');
  });

  // Sprint 1 §4.1 introduced three visible affordances; later cleanup
  // pruned two of them, leaving the user-facing surface as just the
  // token state badge:
  //   1. "兼容旧版浏览器插件（过渡）" — removed in Sprint 3 (hello is
  //      now the only auth path)
  //   2. "允许远程访问（高级）" — hidden post-Sprint-3 because普通用户
  //      用不上；底层 settings.allowRemote / bridge bind host / cache
  //      key 全部保留，可通过手动编辑 data.json 启用
  //   3. token state badge (未填 / 已填 / 已验证) — kept

  it('does not expose the advanced allowRemote / legacy-compat toggles to ordinary users', () => {
    renderMultiPlatformPage(makePlugin({ multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: 'abc',
      allowRemote: false,
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'untested', checkedAt: 0, platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    } }));
    const names = globalThis.__obsidianSettingNamesRegistry;
    expect(names).not.toContain('允许远程访问（高级）');
    expect(names).not.toContain('兼容旧版浏览器插件（过渡）');
  });

  it('renders the Sprint 1 §4.1 token-state badge in the "未填" state when token is empty', () => {
    const page = renderMultiPlatformPage(makePlugin({ multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: '',
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'untested', checkedAt: 0, platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    } }));
    const dot = page.containerEl.querySelector('.wechat-multiplatform-token-status-dot');
    expect(dot).not.toBeNull();
    expect(dot.classList.contains('is-error')).toBe(true);
    expect(dot.textContent).toBe('未填写');
  });

  it('renders the Sprint 1 §4.1 token-state badge in the "已填" state when token is set but unverified', () => {
    const page = renderMultiPlatformPage(makePlugin({ multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: 'abc-xyz',
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'untested', checkedAt: 0, platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    } }));
    const dot = page.containerEl.querySelector('.wechat-multiplatform-token-status-dot');
    expect(dot).not.toBeNull();
    expect(dot.classList.contains('is-unknown')).toBe(true);
    expect(dot.textContent).toBe('等待连接');
  });

  it('renders the Sprint 1 §4.1 token-state badge in the "已验证" state when bridge handshake succeeded', () => {
    const page = renderMultiPlatformPage(makePlugin({ multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: 'abc-xyz',
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'connected', checkedAt: Date.now(), platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    } }));
    const dot = page.containerEl.querySelector('.wechat-multiplatform-token-status-dot');
    expect(dot).not.toBeNull();
    expect(dot.classList.contains('is-ok')).toBe(true);
    expect(dot.textContent).toBe('已就绪');
  });

  it('§16 Phase 1: 无 connectedClients 且未测试时显示「等待连接」', () => {
    const page = renderMultiPlatformPage(makePlugin({ multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: 'abc',
      connectedClients: [],
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'untested', checkedAt: 0, platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    } }));
    const dot = page.containerEl.querySelector('.wechat-multiplatform-token-status-dot');
    expect(dot).not.toBeNull();
    expect(dot.classList.contains('is-unknown')).toBe(true);
    expect(dot.textContent).toBe('等待连接');
  });

  it('§16 Phase 1: 有 profileLabel 时显示 profileLabel（不再叠加 browserName）', () => {
    const page = renderMultiPlatformPage(makePlugin({ multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: 'abc',
      connectedClients: [{
        extensionInstanceId: 'test-instance-id-001',
        browserName: 'chrome',
        profileLabel: '主号',
        capabilities: {},
        extensionVersion: '1.1.4',
        status: 'connected',
        lastSeenAt: Date.now(),
        firstConnectedAt: Date.now() - 5000,
        lastConnectedAt: Date.now(),
      }],
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'connected', checkedAt: Date.now(), platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    } }));
    const dot = page.containerEl.querySelector('.wechat-multiplatform-token-status-dot');
    expect(dot).not.toBeNull();
    expect(dot.classList.contains('is-ok')).toBe(true);
    expect(dot.textContent).toBe('已就绪');
    const body = page.containerEl.querySelector('.wechat-bridge-status-body');
    expect(body).not.toBeNull();
    expect(body.textContent).toContain('主号');
    // Plan B: profileLabel 存在时不再显示 'Chrome'
    expect(body.textContent).not.toContain('Chrome');
    expect(body.querySelector('.wechat-bridge-status-id')).toBeNull();
  });

  it('§16 Phase 1: 无 profileLabel 时降级显示 browserName', () => {
    const page = renderMultiPlatformPage(makePlugin({ multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: 'abc',
      connectedClients: [{
        extensionInstanceId: 'test-instance-id-002',
        browserName: 'chrome',
        profileLabel: '',
        capabilities: {},
        extensionVersion: '1.1.4',
        status: 'connected',
        lastSeenAt: Date.now(),
        firstConnectedAt: Date.now() - 5000,
        lastConnectedAt: Date.now(),
      }],
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'connected', checkedAt: Date.now(), platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    } }));
    const body = page.containerEl.querySelector('.wechat-bridge-status-body');
    expect(body).not.toBeNull();
    expect(body.textContent).toContain('Chrome');
  });

  it('§18.7 Plan B: chrome / chromium 走通用 icon（不撒谎为某个特定 fork）', () => {
    const page = renderMultiPlatformPage(makePlugin({ multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: 'abc',
      connectedClients: [{
        extensionInstanceId: 'test-chromium',
        browserName: 'chrome',
        profileLabel: '',
        capabilities: {},
        extensionVersion: '1.1.4',
        status: 'connected',
        lastSeenAt: Date.now(),
        firstConnectedAt: Date.now() - 5000,
        lastConnectedAt: Date.now(),
      }],
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'connected', checkedAt: Date.now(), platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    } }));
    const body = page.containerEl.querySelector('.wechat-bridge-status-body');
    expect(body.querySelector('.wechat-bridge-browser-icon')).toBeNull();         // no SVG
    expect(body.querySelector('.wechat-bridge-browser-icon-generic')).not.toBeNull(); // generic span
  });

  it('§18.7 Plan B: opt-in 浏览器（如 edge）保留各自品牌 SVG', () => {
    const page = renderMultiPlatformPage(makePlugin({ multiPlatformSync: {
      enabled: true,
      port: 9527,
      token: 'abc',
      connectedClients: [{
        extensionInstanceId: 'test-edge',
        browserName: 'edge',
        profileLabel: '',
        capabilities: {},
        extensionVersion: '1.1.4',
        status: 'connected',
        lastSeenAt: Date.now(),
        firstConnectedAt: Date.now() - 5000,
        lastConnectedAt: Date.now(),
      }],
      supportedPlatforms: [],
      selectedPlatforms: [],
      connection: { status: 'connected', checkedAt: Date.now(), platforms: [], capabilities: {}, message: '' },
      recentTasks: [],
    } }));
    const body = page.containerEl.querySelector('.wechat-bridge-status-body');
    expect(body.querySelector('.wechat-bridge-browser-icon')).not.toBeNull();
  });
});

// 小红书 / X 发布额度（3.11.3）：其他平台页的许可密钥、订单兑换与额度行
describe('multi-platform settings page - license and quota', () => {
  const base = {
    enabled: true, port: 9527, token: 'tok', supportedPlatforms: [], selectedPlatforms: [],
    connection: { status: 'untested', checkedAt: 0, platforms: [], capabilities: {}, message: '' },
    recentTasks: [],
  };

  it('渲染许可密钥与兑换项；扩展离线时额度行提示先连接', () => {
    const page = renderMultiPlatformPage(makePlugin({ multiPlatformSync: { ...base } }));
    const names = globalThis.__obsidianSettingNamesRegistry;
    // 顺序：先兑换、后密钥（兑换成功自动填入）
    const redeemIdx = names.indexOf('第一步：用爱发电订单号兑换密钥');
    const keyIdx = names.indexOf('第二步：许可密钥（付费档）');
    expect(redeemIdx).toBeGreaterThan(-1);
    expect(keyIdx).toBeGreaterThan(redeemIdx);
    expect(page.containerEl.querySelector('.wechat-multiplatform-quota-status').textContent).toContain('连接浏览器插件后显示');
  });

  it('扩展在线时通过桥接读取额度并给出购买链接', async () => {
    const plugin = makePlugin({ multiPlatformSync: { ...base, licenseKey: 'NCS-AAAAA-BBBBB-CCCCC-DDDDD',
      connectedClients: [{ status: 'connected', extensionInstanceId: 'i1', browserName: 'Edge', lastSeenAt: Date.now() }] } });
    const quotaStatus = vi.fn().mockResolvedValue({ tier: 'pro', license_state: 'valid', license_expires_at: '2026-12-01T00:00:00.000Z', limit: 30, used: 2, remaining: 28, reset_at: '2026-09-15T16:00:00.000Z', upgrade_url: 'https://example.com/upgrade' });
    plugin.getWechatSyncBridgeService = vi.fn(() => ({ quotaStatus }));
    const page = renderMultiPlatformPage(plugin);
    await Promise.resolve(); await Promise.resolve();
    expect(quotaStatus).toHaveBeenCalledWith({ licenseKey: 'NCS-AAAAA-BBBBB-CCCCC-DDDDD' });
    const bar = page.containerEl.querySelector('.wechat-multiplatform-quota-status');
    expect(bar.querySelector('.wechat-quota-plan-line').textContent).toContain('当前方案 Pro · 今日剩余 28/30 次');
    expect(bar.querySelector('.wechat-quota-plan-line').textContent).toContain('到期 2026-12-01');
    expect(bar.querySelector('a').textContent).toBe('续费 / 升级');
  });

  it('许可密钥下方展示档位说明（读许可服务 /v1/plans）', async () => {
    const obsidian = require('obsidian');
    const original = obsidian.requestUrl;
    obsidian.requestUrl = vi.fn(async ({ url }) => {
      expect(url).toMatch(/\/v1\/plans$/);
      return { status: 200, json: { ok: true, tiers: { free: { daily_limit: 3 }, pro: { daily_limit: 30 }, max: { daily_limit: null } }, upgrade_url: 'https://afdian.com/a/x' } };
    });
    try {
      const page = renderMultiPlatformPage(makePlugin({ multiPlatformSync: { ...base } }));
      await Promise.resolve(); await Promise.resolve();
      const bar = page.containerEl.querySelector('.wechat-multiplatform-quota-status');
      expect(bar.querySelector('.wechat-quota-tier-line').textContent).toBe('档位：Free 每日 3 次 ｜ Pro 每日 30 次 ｜ Max 不限次');
      // 扩展离线：方案行提示先连接，但仍给购买入口
      expect(bar.querySelector('.wechat-quota-plan-line').textContent).toContain('连接浏览器插件后显示');
      expect(bar.querySelector('a').textContent).toBe('购买 Pro / Max');
    } finally {
      obsidian.requestUrl = original;
    }
  });
});
