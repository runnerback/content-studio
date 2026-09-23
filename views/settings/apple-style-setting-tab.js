// views/settings/apple-style-setting-tab.js
//
// AppleStyleSettingTab（插件设置面板）。
// 3.10.0 起改用 Obsidian 1.13+ 声明式 Settings API：getSettingDefinitions()
// 返回 group / list / page / control / action 定义，由宿主负责渲染、值的读写
// 回调与设置搜索索引。3.11.4 起顶层按「样式 / 分发 / AI」三组排布，组内是子页面：
// 公众号排版、微信公众号、AI 为声明式 items 子页面；飞书 / 其他平台 / 小红书图卡
// 三块命令式 UI 走 page 工厂（见 ./setting-pages.js）按需渲染。普通设置项经 getControlValue /
// setControlValue（支持 `ai.enabled` 这类点路径）读写 plugin.settings，
// 副作用（面板刷新提示、AI 工具栏联动、依赖项重绘）集中在 setControlValue。

import {
  obsidianApi,
  createObsidianModal,
  getObsidianRequestUrl,
  getObsidianRequest,
  getActiveDocumentCompat,
} from '../../services/obsidian-adapters.js';
import { normalizeVaultPath, isAbsolutePathLike } from '../../services/path-utils.js';
import { toReadableError, generateId } from '../../services/input-utils.js';
import {
  MAX_ACCOUNTS,
  MULTI_PLATFORM_TAB_LABEL,
  getWechatAccountPublishOptions,
  normalizeWechatAccountPublishOptions,
} from '../../services/settings-defaults.js';
import { WechatAPI } from '../../services/wechat-api.js';
import { createObsidianFetchAdapter } from '../../services/obsidian-fetch-adapter.js';
import {
  AI_LAYOUT_SELECTION_AUTO,
  AI_PROVIDER_KINDS,
  normalizeAiProvider,
  getAiProviderIssues,
  isAiProviderRunnable,
  summarizeAiProviderIssues,
  getLayoutFamilyList,
  getColorPaletteList,
  normalizeArticleLayoutCacheEntry,
  testAiProviderConnection,
} from '../../services/ai-layout.js';
import {
  FeishuSettingPage,
  MultiPlatformSettingPage,
  RednoteSettingPage,
} from './setting-pages.js';

const { PluginSettingTab, Notice } = obsidianApi;

/** 「AI 编排」与「标题 AI 润色」共用的模型质量选项 */
const AI_MODEL_QUALITY_OPTIONS = {
  'deepseek-v4-pro': 'DeepSeek V4 Pro（质量优先）',
  'deepseek-v4-flash': 'DeepSeek V4 Lite（快/省）',
};
const DEFAULT_AI_MODEL_QUALITY = 'deepseek-v4-pro';
/** 虚拟 key：面板按「秒」编辑，settings 里持久化的是 ai.requestTimeoutMs */
export const AI_REQUEST_TIMEOUT_SECONDS_KEY = 'ai.requestTimeoutSeconds';
const DEFAULT_AI_REQUEST_TIMEOUT_SECONDS = 120;
const MIN_AI_REQUEST_TIMEOUT_SECONDS = 5;
const MAX_AI_REQUEST_TIMEOUT_SECONDS = 180;
const PANEL_RESTART_NOTICE = '设置已保存，请关闭并重新打开发布助手面板以生效';

/**
 * 按点路径读取（如 'ai.enabled'）
 * @param {any} settings
 * @param {string} key
 * @returns {unknown}
 */
function readSettingPath(settings, key) {
  return key.split('.').reduce((current, segment) => (current == null ? undefined : current[segment]), settings);
}

/**
 * 按点路径写入。中间对象缺失说明 settings 未经 loadSettings 归一化，直接抛错暴露问题。
 * @param {any} settings
 * @param {string} key
 * @param {unknown} value
 */
function writeSettingPath(settings, key, value) {
  const segments = key.split('.');
  const leaf = /** @type {string} */ (segments.pop());
  let cursor = settings;
  for (const segment of segments) {
    const next = cursor[segment];
    if (!next || typeof next !== 'object') {
      throw new Error(`设置路径不存在：${key}`);
    }
    cursor = next;
  }
  cursor[leaf] = value;
}

/**
 * @param {{ value: string, label: string }[]} list
 * @returns {Record<string, string>}
 */
function toDropdownOptions(list) {
  /** @type {Record<string, string>} */
  const options = {};
  list.forEach((option) => {
    options[option.value] = option.label;
  });
  return options;
}

/**
 * 📝 Content Studio设置面板
 */
export class AppleStyleSettingTab extends PluginSettingTab {
  /**
   * @param {any} app
   * @param {any} plugin
   */
  constructor(app, plugin) {
    super(app, plugin);
    /** @type {import('../../input.js').AppleStylePluginLike} */
    this.plugin = plugin;
    /** @type {any} 当前打开的子页面（飞书 / 其他平台 / 小红书），供精确重绘 */
    this.activeSettingPage = null;
  }

  /**
   * @param {string} vaultPath
   * @returns {string}
   */
  normalizeVaultPath(vaultPath) {
    return normalizeVaultPath(vaultPath);
  }

  /**
   * @param {string} vaultPath
   * @returns {boolean}
   */
  isAbsolutePathLike(vaultPath) {
    return isAbsolutePathLike(vaultPath);
  }

  refreshOpenConverterAiState() {
    const view = /** @type {any} */ (this.plugin.getConverterView?.() || null);
    if (view && typeof view.updateAiToolbarState === 'function') {
      view.updateAiToolbarState();
    }
    if (view && typeof view.refreshAiLayoutPanel === 'function') {
      view.refreshAiLayoutPanel();
    }
  }

  /**
   * @param {{ title?: string, message?: string, confirmText?: string, cancelText?: string }} options
   * @returns {Promise<boolean>}
   */
  confirmDestructiveAction({ title, message, confirmText = '确认', cancelText = '取消' }) {
    return new Promise((resolve) => {
      const modal = createObsidianModal(this.app);
      let settled = false;
      /** @param {boolean} value */
      const settle = (value) => {
        if (settled) return;
        settled = true;
        modal.close();
        resolve(value);
      };

      modal.titleEl.setText(title || '确认操作');
      const body = modal.contentEl.createDiv({ cls: 'wechat-confirm-modal' });
      body.createEl('p', { text: message || '确定要继续吗？' });
      const actions = modal.contentEl.createDiv({ cls: 'wechat-modal-buttons' });
      actions.createEl('button', { text: cancelText }).onclick = () => settle(false);
      const confirmBtn = actions.createEl('button', { text: confirmText, cls: 'mod-warning' });
      confirmBtn.onclick = () => settle(true);
      const originalOnClose = typeof modal.onClose === 'function'
        ? /** @type {() => void} */ (modal.onClose.bind(modal))
        : null;
      modal.onClose = () => {
        if (originalOnClose) originalOnClose();
        if (!settled) {
          settled = true;
          resolve(false);
        }
      };
      modal.open();
    });
  }

  // ==========================================================================
  // 声明式定义（Obsidian 1.13+）
  // ==========================================================================

  /** @returns {any[]} */
  getSettingDefinitions() {
    return [
      {
        name: 'Note Content Studio',
        desc: '把笔记发布到微信公众号、小红书 / X 与飞书。设置分三组：样式（排版与图卡）、分发（各平台账号与连接）、AI（编排与润色）。',
        searchable: false,
      },
      {
        type: 'group',
        heading: '样式设置',
        items: [
          {
            type: 'page',
            name: '公众号排版',
            desc: '预览模式（手机仿真框）与图片水印头像',
            items: [
              this.getPreviewModeGroupDefinition(),
              this.getWatermarkGroupDefinition(),
            ],
          },
          {
            type: 'page',
            name: '小红书图卡',
            desc: '图卡的用户信息、标题级别、页眉页脚、主题与字体管理（X 图卡同款）',
            page: () => new RednoteSettingPage(this),
          },
        ],
      },
      {
        type: 'group',
        heading: '分发设置',
        items: [
          {
            type: 'page',
            name: '微信公众号',
            desc: '公众号账号列表、默认账号、API 代理',
            displayValue: () => {
              const count = (this.plugin.settings.wechatAccounts || []).length;
              return count > 0 ? `${count} 个账号` : '未配置';
            },
            items: [
              ...this.getWechatAccountDefinitions(),
              this.getProxyGroupDefinition(),
            ],
          },
          {
            type: 'page',
            name: '飞书',
            desc: '飞书自建应用、目标文件夹与 OpenAPI 调用统计',
            page: () => new FeishuSettingPage(this),
          },
          {
            type: 'page',
            name: MULTI_PLATFORM_TAB_LABEL,
            desc: '连接浏览器插件「多栖 Crosspost」发布到小红书 / X；许可密钥与每日额度',
            page: () => new MultiPlatformSettingPage(this),
          },
        ],
      },
      {
        type: 'group',
        heading: 'AI 设置',
        items: [
          {
            type: 'page',
            name: 'AI Provider 与编排',
            desc: 'AI Provider 凭证、AI 编排、标题 AI 润色',
            displayValue: () => (this.plugin.settings.ai?.enabled ? 'AI 编排已开启' : 'AI 编排未开启'),
            items: [
              ...this.getAiProviderDefinitions(),
              this.getAiLayoutGroupDefinition(),
              this.getTitlePolishGroupDefinition(),
            ],
          },
        ],
      },
    ];
  }

  /** 「公众号排版」页：预览模式 */
  getPreviewModeGroupDefinition() {
    return {
      type: 'group',
      heading: '预览模式',
      items: [{
        name: '使用手机仿真框',
        desc: '开启后，预览区域将显示为 iPhone X 手机框样式；关闭则恢复为经典全宽预览模式（需重启插件面板生效）',
        control: { type: 'toggle', key: 'usePhoneFrame' },
      }],
    };
  }

  /** 「公众号排版」页：图片水印 */
  getWatermarkGroupDefinition() {
    const settings = this.plugin.settings;
    return {
      type: 'group',
      heading: '图片水印',
      items: [
        {
          name: '启用图片水印',
          desc: '在每张图片上方显示头像（需重启插件面板生效）',
          control: { type: 'toggle', key: 'enableWatermark' },
        },
        {
          name: '上传本地头像',
          desc: settings.avatarBase64
            ? '✅ 已上传本地头像（优先使用）；点击可重新选择图片'
            : '选择本地图片（小于 100KB），转换为 Base64 存储，无需网络请求',
          action: () => this.pickLocalAvatar(),
        },
        {
          name: '清除本地头像',
          desc: '清除后改用下方「头像 URL（备用）」',
          visible: () => Boolean(this.plugin.settings.avatarBase64),
          action: () => this.clearLocalAvatar(),
        },
        {
          name: '头像 URL（备用）',
          desc: '如未上传本地头像，将使用此 URL',
          control: { type: 'text', key: 'avatarUrl', placeholder: 'https://example.com/avatar.jpg' },
        },
      ],
    };
  }

  /** 「微信公众号」页：API 代理（原「高级设置」） */
  getProxyGroupDefinition() {
    return {
      type: 'group',
      heading: 'API 代理',
      items: [
        {
          name: 'API 代理地址',
          desc: '如果您的网络 IP 经常变化（如多地办公或使用移动热点），可配置代理服务以解决微信 IP 白名单漂移导致的同步失败问题。必须使用 HTTPS。',
          control: {
            type: 'text',
            key: 'proxyUrl',
            placeholder: 'https://your-proxy.workers.dev',
            validate: (/** @type {string} */ value) => this.validateProxyUrl(value),
          },
        },
        {
          name: '测试代理',
          desc: '测试代理是否连通、能否转发到微信',
          action: () => this.testProxyConnection(),
        },
      ],
    };
  }

  /**
   * 读取 control 当前值；支持点路径与虚拟 key（AI 请求超时按秒展示）。
   * @param {string} key
   * @returns {unknown}
   */
  getControlValue(key) {
    if (key === AI_REQUEST_TIMEOUT_SECONDS_KEY) {
      const timeoutMs = Number(this.plugin.settings.ai.requestTimeoutMs) || DEFAULT_AI_REQUEST_TIMEOUT_SECONDS * 1000;
      return Math.round(timeoutMs / 1000);
    }
    return readSettingPath(this.plugin.settings, key);
  }

  /**
   * 写入 control 值并持久化；原各 onChange 的副作用集中在这里。
   * @param {string} key
   * @param {unknown} value
   * @returns {Promise<void>}
   */
  async setControlValue(key, value) {
    const settings = this.plugin.settings;
    let rerenderDependents = false;
    switch (key) {
      case AI_REQUEST_TIMEOUT_SECONDS_KEY: {
        const seconds = Math.min(
          MAX_AI_REQUEST_TIMEOUT_SECONDS,
          Math.max(MIN_AI_REQUEST_TIMEOUT_SECONDS, Math.round(Number(value)) || DEFAULT_AI_REQUEST_TIMEOUT_SECONDS),
        );
        settings.ai.requestTimeoutMs = seconds * 1000;
        break;
      }
      case 'proxyUrl':
        settings.proxyUrl = String(value || '').trim();
        break;
      case 'ai.defaultProviderId':
      case 'defaultAccountId':
        // 列表里的「默认」标记与标题润色说明依赖这两个值，改完重绘面板
        writeSettingPath(settings, key, value);
        rerenderDependents = true;
        break;
      default:
        writeSettingPath(settings, key, value);
    }
    await this.plugin.saveSettings();
    if (key === 'usePhoneFrame' || key === 'enableWatermark') {
      new Notice(PANEL_RESTART_NOTICE);
    }
    if (key.startsWith('ai.')) {
      this.refreshOpenConverterAiState();
    }
    if (rerenderDependents) {
      this.update();
    }
  }

  /**
   * API 代理地址校验：非空时必须 https://，否则拒绝保存并在行内提示。
   * @param {string} value
   * @returns {string | undefined}
   */
  validateProxyUrl(value) {
    const trimmed = String(value || '').trim();
    if (trimmed && !trimmed.toLowerCase().startsWith('https://')) {
      return '安全风险：代理地址必须使用 HTTPS 以保护您的 AppSecret。';
    }
    return undefined;
  }

  /**
   * 微信公众号账号：说明 + 默认账号下拉（group），账号列表（list：点击编辑、+ 添加、行尾删除）
   * @returns {any[]}
   */
  getWechatAccountDefinitions() {
    /** @type {any[]} */
    const accounts = this.plugin.settings.wechatAccounts || [];
    const defaultId = this.plugin.settings.defaultAccountId;
    /** @type {Record<string, string>} */
    const accountOptions = {};
    accounts.forEach((account) => {
      accountOptions[account.id] = account.name;
    });
    return [
      {
        type: 'group',
        heading: '微信公众号账号',
        items: [
          {
            name: '获取凭证',
            desc: '请在微信公众号后台 [设置与开发] → [基本配置] 中获取 AppID 和 AppSecret，并确保已将当前 IP 加入白名单。',
            searchable: false,
          },
          {
            name: '默认账号',
            desc: '同步到微信草稿箱时默认选中的公众号。',
            visible: () => (this.plugin.settings.wechatAccounts || []).length > 0,
            control: { type: 'dropdown', key: 'defaultAccountId', options: accountOptions },
          },
        ],
      },
      {
        type: 'list',
        heading: '账号列表',
        emptyState: '暂无账号，点击右上角「+」添加。',
        items: accounts.map((account) => ({
          name: account.id === defaultId ? `${account.name}（默认）` : account.name,
          desc: `AppID: ${String(account.appId || '').substring(0, 8)}... · 点击编辑或测试连接`,
          action: (/** @type {HTMLElement} */ _el, /** @type {number} */ index) => {
            this.showEditAccountModal(this.plugin.settings.wechatAccounts[index]);
          },
        })),
        addItem: {
          name: '添加账号',
          action: () => {
            if ((this.plugin.settings.wechatAccounts || []).length >= MAX_ACCOUNTS) {
              new Notice(`已达到最大账号数量 (${MAX_ACCOUNTS})`);
              return;
            }
            this.showEditAccountModal(null);
          },
        },
        onDelete: (/** @type {number} */ index) => this.deleteWechatAccount(index),
      },
    ];
  }

  /**
   * AI Provider：默认 Provider 下拉（group），Provider 列表（list）
   * @returns {any[]}
   */
  getAiProviderDefinitions() {
    /** @type {any[]} */
    const providers = this.plugin.settings.ai.providers || [];
    const defaultProviderId = this.plugin.settings.ai.defaultProviderId;
    const runnableProviders = providers.filter((provider) => isAiProviderRunnable(provider) && provider.enabled !== false);
    /** @type {Record<string, string>} */
    const providerOptions = { '': '自动选择' };
    providers.forEach((provider) => {
      providerOptions[provider.id] = `${provider.name} (${summarizeAiProviderIssues(provider)})`;
    });
    return [
      {
        type: 'group',
        heading: 'AI Provider',
        items: [{
          name: '默认 AI Provider',
          desc: `${runnableProviders.length > 0
            ? '生成 AI 编排时会优先使用这里选中的 Provider。'
            : '还没有可直接用于 AI 编排的 Provider，请先补全 Base URL、API Key 和模型。'}「AI 编排」与「标题 AI 润色」都复用它的凭证（当前 DeepSeek），各自的开关与模型质量在下方区块单独设置。`,
          control: { type: 'dropdown', key: 'ai.defaultProviderId', options: providerOptions },
        }],
      },
      {
        type: 'list',
        heading: 'AI Provider 列表',
        emptyState: '暂无 AI Provider，点击右上角「+」添加。',
        items: providers.map((provider) => ({
          name: provider.id === defaultProviderId ? `${provider.name}（默认）` : provider.name,
          desc: `${this.describeAiProviderStatus(provider)} · ${provider.kind} · ${provider.model || '未设置模型'} · ${summarizeAiProviderIssues(provider)} · 点击编辑或测试连接`,
          action: (/** @type {HTMLElement} */ _el, /** @type {number} */ index) => {
            this.showEditAiProviderModal(this.plugin.settings.ai.providers[index]);
          },
        })),
        addItem: {
          name: '添加 AI Provider',
          action: () => this.showEditAiProviderModal(null),
        },
        onDelete: (/** @type {number} */ index) => this.deleteAiProvider(index),
      },
    ];
  }

  /**
   * @param {any} provider
   * @returns {string}
   */
  describeAiProviderStatus(provider) {
    if (provider.enabled === false) return '已停用';
    if (isAiProviderRunnable(provider)) return '可用';
    return '待补全';
  }

  /** @returns {any} */
  getAiLayoutGroupDefinition() {
    const cache = this.getAiLayoutCacheSummary();
    return {
      type: 'group',
      heading: 'AI 编排',
      items: [
        {
          name: '启用 AI 编排',
          desc: '关闭后会隐藏右侧工具栏中的 AI 编排入口，但不会删除已生成的缓存结果。',
          control: { type: 'toggle', key: 'ai.enabled', defaultValue: false },
        },
        {
          name: '模型质量',
          desc: 'AI 编排使用的模型质量，复用上方「默认 AI Provider」的凭证。',
          control: { type: 'dropdown', key: 'ai.layoutModel', options: AI_MODEL_QUALITY_OPTIONS, defaultValue: DEFAULT_AI_MODEL_QUALITY },
        },
        {
          name: '默认布局',
          desc: '打开 AI 编排面板时默认选中的布局。保持“自动推荐”时，AI 会根据文章内容推荐布局风格。',
          control: {
            type: 'dropdown',
            key: 'ai.defaultLayoutFamily',
            options: toDropdownOptions(getLayoutFamilyList({ includeAuto: true, includeReserved: false })),
            defaultValue: AI_LAYOUT_SELECTION_AUTO,
          },
        },
        {
          name: '默认颜色',
          desc: '打开 AI 编排面板时默认选中的颜色。保持“自动推荐”时，AI 会推荐一个配色；生成后也可手动切换。',
          control: {
            type: 'dropdown',
            key: 'ai.defaultColorPalette',
            options: toDropdownOptions(getColorPaletteList({ includeAuto: true })),
            defaultValue: AI_LAYOUT_SELECTION_AUTO,
          },
        },
        {
          name: '编排时参考图片',
          desc: '开启后，AI 会把文中的配图和截图作为排版素材参考，但不会直接改写你的正文。',
          control: { type: 'toggle', key: 'ai.includeImagesInLayout', defaultValue: true },
        },
        {
          name: 'AI 请求超时（秒）',
          desc: '默认 120 秒；较快模型可设 15 到 45 秒，较慢或本地模型建议保持 60 到 120 秒（范围 5–180）。',
          control: {
            type: 'number',
            key: AI_REQUEST_TIMEOUT_SECONDS_KEY,
            min: MIN_AI_REQUEST_TIMEOUT_SECONDS,
            max: MAX_AI_REQUEST_TIMEOUT_SECONDS,
            step: 1,
            placeholder: String(DEFAULT_AI_REQUEST_TIMEOUT_SECONDS),
          },
        },
        cache.layoutCount > 0
          ? {
            name: '清空 AI 编排缓存',
            desc: `当前已缓存 ${cache.docCount} 篇文章、共 ${cache.layoutCount} 份编排风格结果。清空后需重新生成。`,
            action: () => this.clearAiLayoutCache(),
          }
          : {
            name: 'AI 编排缓存',
            desc: '当前还没有缓存的 AI 编排结果。',
            searchable: false,
          },
      ],
    };
  }

  /** @returns {{ docCount: number, layoutCount: number }} */
  getAiLayoutCacheSummary() {
    const entries = Object.values(this.plugin.settings.ai.articleLayoutsByPath || {});
    const layoutCount = entries.reduce((count, entry) => {
      const normalizedEntry = normalizeArticleLayoutCacheEntry(entry);
      if (!normalizedEntry) return count;
      return count + Object.keys(normalizedEntry.familyStates || {}).length;
    }, 0);
    return { docCount: entries.length, layoutCount };
  }

  /**
   * 标题 AI 润色：复用「默认 AI Provider」的 API Key / Base URL（DeepSeek），这里只单独选模型。
   * @returns {any}
   */
  getTitlePolishGroupDefinition() {
    /** @type {any[]} */
    const providers = this.plugin.settings.ai?.providers || [];
    const defaultProviderId = this.plugin.settings.ai?.defaultProviderId;
    const provider = providers.find((item) => item.id === defaultProviderId);
    return {
      type: 'group',
      heading: '标题 AI 润色',
      items: [
        {
          name: '启用标题 AI 润色',
          desc: '开启后，在「发布与分发」的文章标题旁显示「AI 润色标题」按钮，一键让 LLM 根据正文优化标题（给 5 个候选）。',
          control: { type: 'toggle', key: 'titlePolishEnabled', defaultValue: true },
        },
        {
          name: '模型质量',
          desc: provider
            ? `使用 Provider「${provider.name}」的凭证；当前 DeepSeek 可选 V4 Pro / V4 Lite。`
            : '尚未配置默认 AI Provider。请先在上方「AI Provider」里添加并选中一个 Provider（DeepSeek），标题润色才能用。',
          control: { type: 'dropdown', key: 'titlePolishModel', options: AI_MODEL_QUALITY_OPTIONS, defaultValue: DEFAULT_AI_MODEL_QUALITY },
        },
      ],
    };
  }

  // ==========================================================================
  // action 回调
  // ==========================================================================

  /** 选择本地图片作为水印头像（Base64 存储） */
  pickLocalAvatar() {
    const activeDocument = getActiveDocumentCompat();
    if (!activeDocument) return;
    const input = activeDocument.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const target = e.target instanceof HTMLInputElement ? e.target : null;
      const file = target?.files?.[0] || null;
      if (!file) return;

      if (file.size > 100 * 1024) {
        new Notice('❌ 图片太大，请选择小于 100KB 的图片');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result;
        this.plugin.settings.avatarBase64 = typeof result === 'string' ? result : '';
        await this.plugin.saveSettings();
        new Notice('✅ 头像已上传');
        this.update();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async clearLocalAvatar() {
    this.plugin.settings.avatarBase64 = '';
    await this.plugin.saveSettings();
    new Notice('已清除本地头像');
    this.update();
  }

  /**
   * 删除公众号账号（列表 onDelete）：确认后删除；删的是默认账号则回退到第一个。
   * @param {number} index
   */
  async deleteWechatAccount(index) {
    const settings = this.plugin.settings;
    /** @type {any[]} */
    const accounts = settings.wechatAccounts || [];
    const account = accounts[index];
    if (!account) {
      throw new Error(`账号列表索引越界：${index}`);
    }
    const confirmed = await this.confirmDestructiveAction({
      title: '删除公众号账号',
      message: `确定要删除账号 "${account.name}" 吗？`,
      confirmText: '删除',
    });
    if (!confirmed) return;
    settings.wechatAccounts = accounts.filter((item) => item.id !== account.id);
    if (settings.wechatAccounts.length === 0) {
      settings.defaultAccountId = '';
    } else if (settings.defaultAccountId === account.id) {
      settings.defaultAccountId = settings.wechatAccounts[0].id;
    }
    await this.plugin.saveSettings();
    this.update();
  }

  /**
   * 删除 AI Provider（列表 onDelete）：确认后删除；删的是默认 Provider 则改选下一个可用的。
   * @param {number} index
   */
  async deleteAiProvider(index) {
    const ai = this.plugin.settings.ai;
    /** @type {any[]} */
    const providers = ai.providers || [];
    const provider = providers[index];
    if (!provider) {
      throw new Error(`AI Provider 列表索引越界：${index}`);
    }
    const confirmed = await this.confirmDestructiveAction({
      title: '删除 AI Provider',
      message: `确定要删除 AI Provider "${provider.name}" 吗？`,
      confirmText: '删除',
    });
    if (!confirmed) return;
    ai.providers = providers.filter((item) => item.id !== provider.id);
    if (provider.id === ai.defaultProviderId) {
      const nextRunnableProvider = ai.providers.find((item) => item.enabled !== false && isAiProviderRunnable(item));
      ai.defaultProviderId = nextRunnableProvider?.id || '';
    }
    await this.plugin.saveSettings();
    this.refreshOpenConverterAiState();
    this.update();
  }

  async clearAiLayoutCache() {
    const cache = this.getAiLayoutCacheSummary();
    const confirmed = await this.confirmDestructiveAction({
      title: '清空 AI 编排缓存',
      message: `确定要清空 ${cache.docCount} 篇文章、共 ${cache.layoutCount} 份 AI 编排缓存吗？`,
      confirmText: '清空',
    });
    if (!confirmed) return;
    this.plugin.settings.ai.articleLayoutsByPath = {};
    await this.plugin.saveSettings();
    this.refreshOpenConverterAiState();
    new Notice('已清空 AI 编排缓存');
    this.update();
  }

  /**
   * 测试 API 代理：构造一个哑请求经代理转发到微信，看是否收到微信响应。
   * 收到微信 JSON（哪怕是 40013 invalid appid 这类 errcode）= 代理转发链路正常；
   * 抛错（401/403/网络）= 代理不可用或口令不对。
   */
  async testProxyConnection() {
    const proxyUrl = String(this.plugin.settings.proxyUrl || '').trim();
    if (!proxyUrl) {
      new Notice('请先填写 API 代理地址');
      return;
    }
    if (!proxyUrl.toLowerCase().startsWith('https://')) {
      new Notice('❌ 代理地址必须使用 https://');
      return;
    }
    const progress = new Notice('⏳ 正在测试代理…', 0);
    try {
      // 哑凭证 + 哑请求：只验证"代理能否把请求转发到微信并带回响应"，不涉及真实账号
      const api = new WechatAPI('PROXY_TEST', 'PROXY_TEST', proxyUrl, this.plugin.settings.clientId);
      const testUrl = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=PROXY_TEST&secret=PROXY_TEST';
      const result = await api.sendRequest(testUrl, { method: 'GET' });
      if (result && result.errcode !== undefined) {
        new Notice(`✅ 代理生效：请求已经代理转发到微信并收到响应（errcode ${result.errcode}）`, 6000);
      } else {
        new Notice('✅ 代理已连通', 5000);
      }
    } catch (error) {
      new Notice(`❌ 代理测试失败：${toReadableError(error).message}`, 9000);
    } finally {
      progress.hide();
    }
  }

  /**
   * 子页面顶部说明（飞书 / 其他平台 页面复用）
   * @param {any} containerEl
   * @param {string} description
   */
  renderSettingsTabIntro(containerEl, description) {
    const intro = containerEl.createDiv({ cls: 'apple-settings-tab-intro' });
    intro.createEl('p', { text: description, cls: 'apple-settings-tab-intro-desc' });
  }

  // ==========================================================================
  // 模态框（添加 / 编辑）
  // ==========================================================================

  /**
   * 显示添加/编辑 AI Provider 的模态框
   * @param {any} provider
   */
  showEditAiProviderModal(provider) {
    const modal = createObsidianModal(this.app);
    modal.titleEl.setText(provider ? '编辑 AI Provider' : '添加 AI Provider');

    const form = modal.contentEl.createDiv();

    const nameGroup = form.createDiv({ cls: 'wechat-form-group' });
    nameGroup.createEl('label', { text: '名称' });
    const nameInput = /** @type {any} */ (nameGroup.createEl('input', {
      type: 'text',
      placeholder: '例如：OpenAI / OpenRouter / 自建网关',
      value: provider?.name || ''
    }));

    const kindGroup = form.createDiv({ cls: 'wechat-form-group' });
    kindGroup.createEl('label', { text: '类型' });
    const kindSelectWrap = kindGroup.createDiv({ cls: 'wechat-form-select-wrap' });
    const kindSelect = /** @type {any} */ (kindSelectWrap.createEl('select', { cls: 'wechat-form-select' }));
    const providerKinds = [
      { value: AI_PROVIDER_KINDS.OPENAI_COMPATIBLE, label: 'OpenAI 兼容接口' },
      { value: AI_PROVIDER_KINDS.GEMINI, label: 'Gemini 兼容格式' },
      { value: AI_PROVIDER_KINDS.ANTHROPIC, label: 'Anthropic 兼容格式' },
    ];
    providerKinds.forEach((kind) => {
      const option = /** @type {any} */ (kindSelect.createEl('option', { value: kind.value, text: kind.label }));
      if ((provider?.kind || AI_PROVIDER_KINDS.OPENAI_COMPATIBLE) === kind.value) {
        option.selected = true;
      }
    });

    const baseUrlGroup = form.createDiv({ cls: 'wechat-form-group' });
    baseUrlGroup.createEl('label', { text: 'Base URL' });
    const baseUrlInput = /** @type {any} */ (baseUrlGroup.createEl('input', {
      type: 'text',
      placeholder: 'https://api.openai.com/v1 或 http://localhost:11434/v1',
      value: provider?.baseUrl || 'https://api.deepseek.com/v1'
    }));

    const apiKeyGroup = form.createDiv({ cls: 'wechat-form-group' });
    apiKeyGroup.createEl('label', { text: 'API Key' });
    const apiKeyInput = /** @type {any} */ (apiKeyGroup.createEl('input', {
      type: 'password',
      placeholder: 'sk-...',
      value: provider?.apiKey || ''
    }));

    // 模型：Provider 层只标明模型家族「DeepSeek V4」一项；具体 Pro/Lite 质量
    // 由各消费方（标题润色 / AI 编排）在各自设置里选，故这里不放质量选项。
    const modelGroup = form.createDiv({ cls: 'wechat-form-group' });
    modelGroup.createEl('label', { text: '模型' });
    const modelSelectWrap = modelGroup.createDiv({ cls: 'wechat-form-select-wrap' });
    const modelSelect = /** @type {any} */ (modelSelectWrap.createEl('select', { cls: 'wechat-form-select' }));
    // value 用真实模型作默认/兜底（测试连接、消费方未覆盖时可用），label 只显示家族名
    const opt = /** @type {any} */ (modelSelect.createEl('option', { value: 'deepseek-v4-pro', text: 'DeepSeek V4' }));
    opt.selected = true;

    const applyKindDefaults = () => {
      const kind = kindSelect.value || AI_PROVIDER_KINDS.OPENAI_COMPATIBLE;
      if (kind === AI_PROVIDER_KINDS.GEMINI) {
        baseUrlInput.placeholder = 'https://generativelanguage.googleapis.com/v1beta';
        if ((!provider || provider.kind !== kind) && !baseUrlInput.value.trim()) {
          baseUrlInput.value = 'https://generativelanguage.googleapis.com/v1beta';
        }
        return;
      }
      if (kind === AI_PROVIDER_KINDS.ANTHROPIC) {
        baseUrlInput.placeholder = 'https://api.anthropic.com/v1';
        if ((!provider || provider.kind !== kind) && !baseUrlInput.value.trim()) {
          baseUrlInput.value = 'https://api.anthropic.com/v1';
        }
        return;
      }
      // OpenAI 兼容（DeepSeek 走这条）：默认指向 DeepSeek
      baseUrlInput.placeholder = 'https://api.deepseek.com/v1 或 http://localhost:11434/v1';
      if ((!provider || provider.kind !== kind) && !baseUrlInput.value.trim()) {
        baseUrlInput.value = 'https://api.deepseek.com/v1';
      }
    };
    kindSelect.addEventListener('change', applyKindDefaults);
    applyKindDefaults();

    const enabledGroup = form.createDiv({ cls: 'wechat-form-group' });
    enabledGroup.createEl('label', { text: '启用' });
    const enabledWrap = enabledGroup.createDiv({ cls: 'wechat-provider-enabled' });
    const enabledToggle = /** @type {any} */ (enabledWrap.createEl('label', { cls: 'apple-toggle' }).createEl('input', {
      type: 'checkbox',
      cls: 'apple-toggle-input',
      checked: provider?.enabled !== false ? true : undefined,
    }));
    enabledToggle.checked = provider?.enabled !== false;
    enabledToggle.parentElement.createEl('span', { cls: 'apple-toggle-slider' });
    enabledWrap.createEl('span', {
      cls: 'wechat-provider-enabled-text',
      text: '保存后可用于 AI 编排和连接测试',
    });

    const btnRow = form.createDiv({ cls: 'wechat-modal-buttons' });
    const cancelBtn = btnRow.createEl('button', { text: '取消' });
    cancelBtn.onclick = () => modal.close();

    const testBtn = btnRow.createEl('button', { text: '测试连接', cls: 'wechat-btn-test' });
    testBtn.onclick = async () => {
      const candidate = normalizeAiProvider({
        id: provider?.id,
        name: nameInput.value.trim() || '未命名 Provider',
        kind: kindSelect.value,
        baseUrl: baseUrlInput.value.trim(),
        apiKey: apiKeyInput.value.trim(),
        model: modelSelect.value,
        enabled: enabledToggle.checked,
      });
      const issueSummary = summarizeAiProviderIssues(candidate);
      if (!isAiProviderRunnable(candidate)) {
        new Notice(`请先补全 Provider 配置：${issueSummary}`);
        return;
      }
      testBtn.disabled = true;
      testBtn.textContent = '测试中...';
      try {
        await testAiProviderConnection(candidate, createObsidianFetchAdapter({ requestUrl: getObsidianRequestUrl(), request: getObsidianRequest() }));
        new Notice('✅ AI Provider 连接成功！');
      } catch (error) {
        new Notice(`❌ 连接失败: ${toReadableError(error).message}`);
      }
      testBtn.disabled = false;
      testBtn.textContent = '测试连接';
    };

    const saveBtn = btnRow.createEl('button', { text: '保存', cls: 'mod-cta' });
    saveBtn.onclick = async () => {
      const nextProvider = normalizeAiProvider({
        id: provider?.id,
        name: nameInput.value.trim() || '未命名 Provider',
        kind: kindSelect.value,
        baseUrl: baseUrlInput.value.trim(),
        apiKey: apiKeyInput.value.trim(),
        model: modelSelect.value,
        enabled: enabledToggle.checked,
      });

      const issues = getAiProviderIssues(nextProvider).filter((issue) => issue !== 'disabled');
      if (issues.length > 0) {
        new Notice(`请补全 Provider 配置：${summarizeAiProviderIssues(nextProvider)}`);
        return;
      }

      const providers = this.plugin.settings.ai.providers || [];
      if (provider) {
        this.plugin.settings.ai.providers = providers.map((item) => item.id === provider.id ? nextProvider : item);
      } else {
        this.plugin.settings.ai.providers.push(nextProvider);
        if (!this.plugin.settings.ai.defaultProviderId) {
          this.plugin.settings.ai.defaultProviderId = nextProvider.id;
        }
      }

      if (!this.plugin.settings.ai.defaultProviderId && nextProvider.enabled !== false && isAiProviderRunnable(nextProvider)) {
        this.plugin.settings.ai.defaultProviderId = nextProvider.id;
      }

      await this.plugin.saveSettings();
      this.refreshOpenConverterAiState();
      modal.close();
      this.update();
      new Notice(provider ? '✅ AI Provider 已更新' : '✅ AI Provider 已添加');
    };

    modal.open();
  }

  /**
   * 显示添加/编辑账号的模态框
   * @param {any} account
   */
  showEditAccountModal(account) {
    const modal = createObsidianModal(this.app);
    modal.titleEl.setText(account ? '编辑账号' : '添加账号');

    const form = modal.contentEl.createDiv();
    const publishDefaults = getWechatAccountPublishOptions(account);

    // 账号名称
    const nameGroup = form.createDiv({ cls: 'wechat-form-group' });
    nameGroup.createEl('label', { text: '账号名称' });
    const nameInput = /** @type {any} */ (nameGroup.createEl('input', {
      type: 'text',
      placeholder: '例如：我的公众号',
      value: account?.name || ''
    }));

    // AppID
    const appIdGroup = form.createDiv({ cls: 'wechat-form-group' });
    appIdGroup.createEl('label', { text: 'AppID' });
    const appIdInput = /** @type {any} */ (appIdGroup.createEl('input', {
      type: 'text',
      placeholder: 'wx...',
      value: account?.appId || ''
    }));

    // AppSecret
    const secretGroup = form.createDiv({ cls: 'wechat-form-group' });
    secretGroup.createEl('label', { text: 'AppSecret' });
    const secretInput = /** @type {any} */ (secretGroup.createEl('input', {
      type: 'password',
      placeholder: '开发者密钥',
      value: account?.appSecret || ''
    }));

    // 默认作者
    const authorGroup = form.createDiv({ cls: 'wechat-form-group' });
    authorGroup.createEl('label', { text: '默认作者（可选）' });
    const authorInput = /** @type {any} */ (authorGroup.createEl('input', {
      type: 'text',
      placeholder: '留空则不显示作者',
      value: account?.author || ''
    }));

    const publishOptions = form.createEl('details', { cls: 'wechat-sync-advanced wechat-account-publish-options' });
    publishOptions.createEl('summary', {
      text: '发布选项',
      cls: 'wechat-sync-advanced-summary',
    });
    const publishSection = publishOptions.createDiv({ cls: 'wechat-sync-advanced-body wechat-account-publish-body' });
    publishSection.createEl('div', {
      text: '可为当前公众号预设原文链接与留言相关的默认发布策略。',
      cls: 'wechat-form-help',
    });

    const sourceUrlGroup = publishSection.createDiv({ cls: 'wechat-form-group' });
    sourceUrlGroup.createEl('label', { text: '默认原文链接（可选）' });
    const sourceUrlInput = /** @type {any} */ (sourceUrlGroup.createEl('input', {
      type: 'url',
      placeholder: '留空则不同步原文链接',
      value: publishDefaults.contentSourceUrl,
    }));

    const commentGroup = publishSection.createDiv({ cls: 'wechat-form-checkbox-group' });
    const commentLabel = commentGroup.createEl('label', { cls: 'wechat-form-checkbox-label' });
    const commentInput = /** @type {any} */ (commentLabel.createEl('input', { type: 'checkbox' }));
    commentInput.checked = publishDefaults.openComment;
    commentLabel.appendText('默认开启留言');

    const fansCommentGroup = publishSection.createDiv({ cls: 'wechat-form-checkbox-group' });
    const fansCommentLabel = fansCommentGroup.createEl('label', { cls: 'wechat-form-checkbox-label' });
    const fansCommentInput = /** @type {any} */ (fansCommentLabel.createEl('input', { type: 'checkbox' }));
    fansCommentInput.checked = publishDefaults.openComment && publishDefaults.onlyFansCanComment;
    fansCommentLabel.appendText('默认仅粉丝可留言');
    fansCommentGroup.createEl('div', {
      text: '关闭留言时，此选项不会生效。',
      cls: 'wechat-form-help',
    });

    const syncCommentDependency = () => {
      const enabled = commentInput.checked;
      fansCommentInput.disabled = !enabled;
      fansCommentGroup.toggleClass('is-disabled', !enabled);
      if (!enabled) fansCommentInput.checked = false;
    };
    commentInput.addEventListener('change', syncCommentDependency);
    syncCommentDependency();

    // 按钮区
    const btnRow = form.createDiv({ cls: 'wechat-modal-buttons' });

    const cancelBtn = btnRow.createEl('button', { text: '取消' });
    cancelBtn.onclick = () => modal.close();

    const testBtn = btnRow.createEl('button', { text: '测试连接', cls: 'wechat-btn-test' });
    testBtn.onclick = async () => {
      if (!appIdInput.value || !secretInput.value) {
        new Notice('请填写 AppID 和 AppSecret');
        return;
      }
      testBtn.disabled = true;
      testBtn.textContent = '测试中...';
      try {
        const api = new WechatAPI(appIdInput.value.trim(), secretInput.value.trim(), this.plugin.settings.proxyUrl, this.plugin.settings.clientId);
        await api.getAccessToken();
        new Notice('✅ 连接成功！');
      } catch (err) {
        new Notice(`❌ 连接失败: ${toReadableError(err).message}`);
      }
      testBtn.disabled = false;
      testBtn.textContent = '测试连接';
    };

    const saveBtn = btnRow.createEl('button', { text: '保存', cls: 'mod-cta' });
    saveBtn.onclick = async () => {
      const name = nameInput.value.trim() || '未命名账号';
      const appId = appIdInput.value.trim();
      const appSecret = secretInput.value.trim();

      if (!appId || !appSecret) {
        new Notice('请填写 AppID 和 AppSecret');
        return;
      }

      const publishOptions = normalizeWechatAccountPublishOptions({
        contentSourceUrl: sourceUrlInput.value,
        openComment: commentInput.checked,
        onlyFansCanComment: fansCommentInput.checked,
      });

      if (account) {
        // 编辑现有账号
        account.name = name;
        account.appId = appId;
        account.appSecret = appSecret;
        account.author = authorInput.value.trim();
        Object.assign(account, publishOptions);
      } else {
        // 添加新账号
        const newAccount = {
          id: generateId(),
          name,
          appId,
          appSecret,
          author: authorInput.value.trim(),
          ...publishOptions,
        };
        this.plugin.settings.wechatAccounts.push(newAccount);
        // 如果是第一个账号，自动设为默认
        if (this.plugin.settings.wechatAccounts.length === 1) {
          this.plugin.settings.defaultAccountId = newAccount.id;
        }
      }

      await this.plugin.saveSettings();
      modal.close();
      this.update();
      new Notice(account ? '✅ 账号已更新' : '✅ 账号已添加');
    };

    modal.open();
  }
}
