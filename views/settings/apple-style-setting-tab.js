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
} from '../../services/obsidian-adapters.js';
import { normalizeVaultPath, isAbsolutePathLike } from '../../services/path-utils.js';
import { toReadableError, toText, generateId } from '../../services/input-utils.js';
import { t } from '../../services/i18n.js';
import {
  MAX_ACCOUNTS,
  getMultiPlatformTabLabel,
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
  normalizeAiUsageTotals,
  estimateAiUsageCost,
} from '../../services/ai-layout.js';
import {
  FeishuSettingPage,
  MultiPlatformSettingPage,
  RednoteSettingPage,
} from './setting-pages.js';

const { PluginSettingTab, Notice } = obsidianApi;

/**
 * @typedef {import('obsidian').SettingDefinitionItem} SettingDefinitionItem
 * @typedef {import('obsidian').SettingDefinitionGroup} SettingDefinitionGroup
 * @typedef {import('../../input.js').AppleStylePluginLike} AppleStylePluginLike
 * @typedef {import('../../input.js').AppleStyleViewInstance} AppleStyleViewInstance
 * @typedef {import('../../input.js').WechatAccountLike} WechatAccountLike
 * @typedef {import('../../input.js').AiProviderLike} AiProviderLike
 */

/**
 * 「AI 编排」与「标题 AI 润色」共用的模型质量选项（渲染时取当前语言文案）
 * @returns {Record<string, string>}
 */
function getAiModelQualityOptions() {
  return {
    'deepseek-v4-pro': t('settingsTab.modelQualityPro'),
    'deepseek-v4-flash': t('settingsTab.modelQualityLite'),
  };
}
const DEFAULT_AI_MODEL_QUALITY = 'deepseek-v4-pro';
/**
 * Provider 层只标明模型家族一项；具体 Pro/Lite 质量由各消费方（标题润色 / AI 编排）
 * 在各自设置里选。value 用真实模型作默认/兜底（测试连接、消费方未覆盖时可用），label 只显示家族名。
 */
const AI_MODEL_FAMILY_OPTION = { value: 'deepseek-v4-pro', label: 'DeepSeek V4' };
/**
 * 各 Provider 类型的 Base URL 占位与默认值：切换类型且输入框为空时自动填入。
 * OpenAI 兼容（DeepSeek 走这条）默认指向 DeepSeek。占位文案随界面语言，故在渲染时取。
 * @returns {Record<string, { placeholder: string, baseUrl: string }>}
 */
function getAiProviderBaseUrlDefaults() {
  return {
    [AI_PROVIDER_KINDS.GEMINI]: { placeholder: 'https://generativelanguage.googleapis.com/v1beta', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
    [AI_PROVIDER_KINDS.ANTHROPIC]: { placeholder: 'https://api.anthropic.com/v1', baseUrl: 'https://api.anthropic.com/v1' },
    [AI_PROVIDER_KINDS.OPENAI_COMPATIBLE]: { placeholder: t('settingsTab.aiProviderBaseUrlPlaceholderOpenaiCompatible'), baseUrl: 'https://api.deepseek.com/v1' },
  };
}
/** 虚拟 key：面板按「秒」编辑，settings 里持久化的是 ai.requestTimeoutMs */
export const AI_REQUEST_TIMEOUT_SECONDS_KEY = 'ai.requestTimeoutSeconds';
const DEFAULT_AI_REQUEST_TIMEOUT_SECONDS = 120;
const MIN_AI_REQUEST_TIMEOUT_SECONDS = 5;
const MAX_AI_REQUEST_TIMEOUT_SECONDS = 180;

/**
 * 按点路径读取（如 'ai.enabled'）；途中遇到 null / undefined 即返回 undefined
 * @param {Record<string, unknown>} settings
 * @param {string} key
 * @returns {unknown}
 */
function readSettingPath(settings, key) {
  /** @type {unknown} */
  let current = settings;
  for (const segment of key.split('.')) {
    if (current === null || current === undefined) return undefined;
    current = /** @type {Record<string, unknown>} */ (current)[segment];
  }
  return current;
}

/**
 * 按点路径写入。中间对象缺失说明 settings 未经 loadSettings 归一化，直接抛错暴露问题。
 * @param {Record<string, unknown>} settings
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
    cursor = /** @type {Record<string, unknown>} */ (next);
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
   * @param {import('obsidian').App} app
   * @param {AppleStylePluginLike} plugin 运行时是 AppleStylePlugin（Plugin 子类）；测试里是形状对齐的普通对象
   */
  constructor(app, plugin) {
    super(app, /** @type {import('obsidian').Plugin} */ (/** @type {unknown} */ (plugin)));
    /** @type {AppleStylePluginLike} */
    this.plugin = plugin;
    /** @type {import('./setting-pages.js').ContentStudioSettingPageLike | null} 当前打开的命令式子页面（飞书 / 其他平台 / 小红书图卡），供精确重绘 */
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
    const view = /** @type {AppleStyleViewInstance | null} */ (this.plugin.getConverterView?.() || null);
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
  confirmDestructiveAction({ title, message, confirmText = t('settingsTab.confirm'), cancelText = t('settingsTab.cancel') }) {
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

      modal.titleEl.setText(title || t('settingsTab.confirmActionTitle'));
      const body = modal.contentEl.createDiv({ cls: 'wechat-confirm-modal' });
      body.createEl('p', { text: message || t('settingsTab.confirmActionMessage') });
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

  /** @returns {SettingDefinitionItem[]} */
  getSettingDefinitions() {
    return [
      {
        name: 'Note Content Studio',
        desc: t('settingsTab.introDesc'),
        searchable: false,
      },
      {
        type: 'group',
        heading: t('settingsTab.groupStyle'),
        items: [
          // 3.12.0：手机仿真框与图片水印挪到预览面板「样式设置 → 高级选项」即时生效，样式只剩一个入口
          {
            type: 'page',
            name: t('settingsTab.pageRednote'),
            desc: t('settingsTab.pageRednoteDesc'),
            page: () => new RednoteSettingPage(this),
          },
          {
            name: t('settingsTab.autoSwitchPlatformName'),
            desc: t('settingsTab.autoSwitchPlatformDesc'),
            control: { type: 'toggle', key: 'autoSwitchPlatformByProperty' },
          },
        ],
      },
      {
        type: 'group',
        heading: t('settingsTab.groupDistribution'),
        items: [
          {
            type: 'page',
            name: t('settingsTab.pageWechat'),
            desc: t('settingsTab.pageWechatDesc'),
            displayValue: () => {
              const count = (this.plugin.settings.wechatAccounts || []).length;
              return count > 0 ? t('settingsTab.wechatAccountCount', { count }) : t('settingsTab.wechatNotConfigured');
            },
            items: [
              ...this.getWechatAccountDefinitions(),
              this.getProxyGroupDefinition(),
            ],
          },
          {
            type: 'page',
            name: t('settingsTab.pageFeishu'),
            desc: t('settingsTab.pageFeishuDesc'),
            page: () => new FeishuSettingPage(this),
          },
          {
            type: 'page',
            name: getMultiPlatformTabLabel(),
            desc: t('settingsTab.pageMultiPlatformDesc'),
            page: () => new MultiPlatformSettingPage(this),
          },
        ],
      },
      {
        type: 'group',
        heading: t('settingsTab.groupAi'),
        items: [
          {
            type: 'page',
            name: t('settingsTab.pageAi'),
            desc: t('settingsTab.pageAiDesc'),
            displayValue: () => (this.plugin.settings.ai?.enabled ? t('settingsTab.aiLayoutEnabledValue') : t('settingsTab.aiLayoutDisabledValue')),
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

  /**
   * 「微信公众号」页：API 代理（原「高级设置」）
   * @returns {SettingDefinitionGroup}
   */
  getProxyGroupDefinition() {
    return {
      type: 'group',
      heading: t('settingsTab.proxyHeading'),
      items: [
        {
          name: t('settingsTab.proxyUrlName'),
          desc: t('settingsTab.proxyUrlDesc'),
          control: {
            type: 'text',
            key: 'proxyUrl',
            placeholder: 'https://your-proxy.workers.dev',
            validate: (/** @type {string} */ value) => this.validateProxyUrl(value),
          },
        },
        {
          name: t('settingsTab.testProxyName'),
          desc: t('settingsTab.testProxyDesc'),
          action: () => { void this.testProxyConnection(); },
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
        settings.proxyUrl = toText(value).trim();
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
      return t('settingsTab.proxyUrlHttpsRequired');
    }
    return undefined;
  }

  /**
   * 微信公众号账号：说明 + 默认账号下拉（group），账号列表（list：点击编辑、+ 添加、行尾删除）
   * @returns {SettingDefinitionItem[]}
   */
  getWechatAccountDefinitions() {
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
        heading: t('settingsTab.wechatAccountsHeading'),
        items: [
          {
            name: t('settingsTab.wechatCredentialsName'),
            desc: t('settingsTab.wechatCredentialsDesc'),
            searchable: false,
          },
          {
            name: t('settingsTab.defaultAccountName'),
            desc: t('settingsTab.defaultAccountDesc'),
            visible: () => (this.plugin.settings.wechatAccounts || []).length > 0,
            control: { type: 'dropdown', key: 'defaultAccountId', options: accountOptions },
          },
        ],
      },
      {
        type: 'list',
        heading: t('settingsTab.accountListHeading'),
        emptyState: t('settingsTab.accountListEmpty'),
        items: accounts.map((account) => ({
          name: account.id === defaultId ? t('settingsTab.defaultItemName', { name: account.name }) : account.name,
          desc: t('settingsTab.accountItemDesc', { appId: String(account.appId || '').substring(0, 8) }),
          action: (/** @type {HTMLElement} */ _el, /** @type {number} */ index) => {
            this.showEditAccountModal(this.plugin.settings.wechatAccounts[index]);
          },
        })),
        addItem: {
          name: t('settingsTab.addAccount'),
          action: () => {
            if ((this.plugin.settings.wechatAccounts || []).length >= MAX_ACCOUNTS) {
              new Notice(t('settingsTab.maxAccountsReached', { max: MAX_ACCOUNTS }));
              return;
            }
            this.showEditAccountModal(null);
          },
        },
        onDelete: (/** @type {number} */ index) => { void this.deleteWechatAccount(index); },
      },
    ];
  }

  /**
   * AI Provider：默认 Provider 下拉（group），Provider 列表（list）
   * @returns {SettingDefinitionItem[]}
   */
  getAiProviderDefinitions() {
    const providers = this.plugin.settings.ai.providers || [];
    const defaultProviderId = this.plugin.settings.ai.defaultProviderId;
    const runnableProviders = providers.filter((provider) => isAiProviderRunnable(provider) && provider.enabled !== false);
    /** @type {Record<string, string>} */
    const providerOptions = { '': t('settingsTab.aiProviderAuto') };
    providers.forEach((provider) => {
      providerOptions[provider.id] = `${provider.name} (${summarizeAiProviderIssues(provider)})`;
    });
    return [
      {
        type: 'group',
        heading: 'AI Provider',
        items: [{
          name: t('settingsTab.defaultAiProviderName'),
          desc: t('settingsTab.defaultAiProviderDesc', {
            lead: t(runnableProviders.length > 0
              ? 'settingsTab.defaultAiProviderDescRunnable'
              : 'settingsTab.defaultAiProviderDescMissing'),
          }),
          control: { type: 'dropdown', key: 'ai.defaultProviderId', options: providerOptions },
        }],
      },
      {
        type: 'list',
        heading: t('settingsTab.aiProviderListHeading'),
        emptyState: t('settingsTab.aiProviderListEmpty'),
        items: providers.map((provider) => ({
          name: provider.id === defaultProviderId ? t('settingsTab.defaultItemName', { name: provider.name }) : provider.name,
          desc: t('settingsTab.aiProviderItemDesc', {
            status: this.describeAiProviderStatus(provider),
            kind: provider.kind,
            model: provider.model || t('settingsTab.aiProviderNoModel'),
            issues: summarizeAiProviderIssues(provider),
          }),
          action: (/** @type {HTMLElement} */ _el, /** @type {number} */ index) => {
            this.showEditAiProviderModal(this.plugin.settings.ai.providers[index]);
          },
        })),
        addItem: {
          name: t('settingsTab.addAiProvider'),
          action: () => this.showEditAiProviderModal(null),
        },
        onDelete: (/** @type {number} */ index) => { void this.deleteAiProvider(index); },
      },
    ];
  }

  /**
   * @param {AiProviderLike} provider
   * @returns {string}
   */
  describeAiProviderStatus(provider) {
    if (provider.enabled === false) return t('settingsTab.aiProviderStatusDisabled');
    if (isAiProviderRunnable(provider)) return t('settingsTab.aiProviderStatusReady');
    return t('settingsTab.aiProviderStatusIncomplete');
  }

  /** @returns {SettingDefinitionGroup} */
  getAiLayoutGroupDefinition() {
    const cache = this.getAiLayoutCacheSummary();
    return {
      type: 'group',
      heading: t('settingsTab.aiLayoutHeading'),
      items: [
        {
          name: t('settingsTab.aiLayoutEnabledName'),
          desc: t('settingsTab.aiLayoutEnabledDesc'),
          control: { type: 'toggle', key: 'ai.enabled', defaultValue: false },
        },
        {
          name: t('settingsTab.modelQualityName'),
          desc: t('settingsTab.aiLayoutModelQualityDesc'),
          control: { type: 'dropdown', key: 'ai.layoutModel', options: getAiModelQualityOptions(), defaultValue: DEFAULT_AI_MODEL_QUALITY },
        },
        {
          name: t('settingsTab.defaultLayoutName'),
          desc: t('settingsTab.defaultLayoutDesc'),
          control: {
            type: 'dropdown',
            key: 'ai.defaultLayoutFamily',
            options: toDropdownOptions(getLayoutFamilyList({ includeAuto: true, includeReserved: false })),
            defaultValue: AI_LAYOUT_SELECTION_AUTO,
          },
        },
        {
          name: t('settingsTab.defaultColorName'),
          desc: t('settingsTab.defaultColorDesc'),
          control: {
            type: 'dropdown',
            key: 'ai.defaultColorPalette',
            options: toDropdownOptions(getColorPaletteList({ includeAuto: true })),
            defaultValue: AI_LAYOUT_SELECTION_AUTO,
          },
        },
        {
          name: t('settingsTab.includeImagesName'),
          desc: t('settingsTab.includeImagesDesc'),
          control: { type: 'toggle', key: 'ai.includeImagesInLayout', defaultValue: true },
        },
        {
          name: t('settingsTab.aiTimeoutName'),
          desc: t('settingsTab.aiTimeoutDesc'),
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
            name: t('settingsTab.clearAiLayoutCacheName'),
            desc: t('settingsTab.clearAiLayoutCacheDesc', { docCount: cache.docCount, layoutCount: cache.layoutCount }),
            action: () => { void this.clearAiLayoutCache(); },
          }
          : {
            name: t('settingsTab.aiLayoutCacheName'),
            desc: t('settingsTab.aiLayoutCacheEmptyDesc'),
            searchable: false,
          },
        // 3.12.0：费用可见性——本机累计用量 + 单价（元 / 百万 tokens）
        {
          name: t('settingsTab.aiUsageName'),
          desc: this.describeAiUsageTotals(),
          searchable: false,
        },
        {
          name: t('settingsTab.aiUsageResetName'),
          desc: t('settingsTab.aiUsageResetDesc'),
          visible: () => normalizeAiUsageTotals(this.plugin.settings.ai.usageTotals).requests > 0,
          action: () => { void this.resetAiUsageTotals(); },
        },
        {
          name: t('settingsTab.aiPriceInputName'),
          desc: t('settingsTab.aiPriceInputDesc'),
          control: { type: 'number', key: 'ai.usagePricePerMillion.input', min: 0, max: 100000, step: 0.01, placeholder: '0', defaultValue: 0 },
        },
        {
          name: t('settingsTab.aiPriceOutputName'),
          desc: t('settingsTab.aiPriceOutputDesc'),
          control: { type: 'number', key: 'ai.usagePricePerMillion.output', min: 0, max: 100000, step: 0.01, placeholder: '0', defaultValue: 0 },
        },
      ],
    };
  }

  /**
   * 「本机累计用量」说明：次数 + 输入 / 输出 tokens，填了单价再带上估算费用。
   * @returns {string}
   */
  describeAiUsageTotals() {
    const totals = normalizeAiUsageTotals(this.plugin.settings.ai.usageTotals);
    if (totals.requests === 0) return t('settingsTab.aiUsageDescEmpty');
    const cost = estimateAiUsageCost(totals, this.plugin.settings.ai.usagePricePerMillion);
    const base = t('settingsTab.aiUsageDesc', {
      requests: totals.requests,
      prompt: totals.promptTokens.toLocaleString('zh-CN'),
      completion: totals.completionTokens.toLocaleString('zh-CN'),
      total: totals.totalTokens.toLocaleString('zh-CN'),
    });
    return cost === null ? base : `${base}${t('settingsTab.aiUsageCostSuffix', { cost: cost.toFixed(2) })}`;
  }

  async resetAiUsageTotals() {
    await this.plugin.resetAiUsageTotals();
    new Notice(t('settingsTab.aiUsageResetDone'));
    this.update();
  }

  /** @returns {{ docCount: number, layoutCount: number }} */
  getAiLayoutCacheSummary() {
    const entries = Object.values(this.plugin.settings.ai.articleLayoutsByPath || {});
    let layoutCount = 0;
    for (const entry of entries) {
      const normalizedEntry = normalizeArticleLayoutCacheEntry(entry);
      if (!normalizedEntry) continue;
      layoutCount += Object.keys(normalizedEntry.familyStates || {}).length;
    }
    return { docCount: entries.length, layoutCount };
  }

  /**
   * 标题 AI 润色：复用「默认 AI Provider」的 API Key / Base URL（DeepSeek），这里只单独选模型。
   * @returns {SettingDefinitionGroup}
   */
  getTitlePolishGroupDefinition() {
    const providers = this.plugin.settings.ai?.providers || [];
    const defaultProviderId = this.plugin.settings.ai?.defaultProviderId;
    const provider = providers.find((item) => item.id === defaultProviderId);
    return {
      type: 'group',
      heading: t('settingsTab.titlePolishHeading'),
      items: [
        {
          name: t('settingsTab.titlePolishEnabledName'),
          desc: t('settingsTab.titlePolishEnabledDesc'),
          control: { type: 'toggle', key: 'titlePolishEnabled', defaultValue: true },
        },
        {
          name: t('settingsTab.modelQualityName'),
          desc: provider
            ? t('settingsTab.titlePolishModelDesc', { name: provider.name })
            : t('settingsTab.titlePolishModelDescNoProvider'),
          control: { type: 'dropdown', key: 'titlePolishModel', options: getAiModelQualityOptions(), defaultValue: DEFAULT_AI_MODEL_QUALITY },
        },
      ],
    };
  }

  // ==========================================================================
  // action 回调
  // ==========================================================================

  /** 选择本地图片作为水印头像（Base64 存储） */
  /**
   * 删除公众号账号（列表 onDelete）：确认后删除；删的是默认账号则回退到第一个。
   * @param {number} index
   */
  async deleteWechatAccount(index) {
    const settings = this.plugin.settings;
    const accounts = settings.wechatAccounts || [];
    const account = accounts[index];
    if (!account) {
      throw new Error(`账号列表索引越界：${index}`);
    }
    const confirmed = await this.confirmDestructiveAction({
      title: t('settingsTab.deleteAccountTitle'),
      message: t('settingsTab.deleteAccountConfirm', { name: account.name }),
      confirmText: t('settingsTab.delete'),
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
    const providers = ai.providers || [];
    const provider = providers[index];
    if (!provider) {
      throw new Error(`AI Provider 列表索引越界：${index}`);
    }
    const confirmed = await this.confirmDestructiveAction({
      title: t('settingsTab.deleteAiProviderTitle'),
      message: t('settingsTab.deleteAiProviderConfirm', { name: provider.name }),
      confirmText: t('settingsTab.delete'),
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
      title: t('settingsTab.clearAiLayoutCacheName'),
      message: t('settingsTab.clearAiLayoutCacheConfirm', { docCount: cache.docCount, layoutCount: cache.layoutCount }),
      confirmText: t('settingsTab.clear'),
    });
    if (!confirmed) return;
    this.plugin.settings.ai.articleLayoutsByPath = {};
    await this.plugin.saveSettings();
    this.refreshOpenConverterAiState();
    new Notice(t('settingsTab.aiLayoutCacheCleared'));
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
      new Notice(t('settingsTab.proxyUrlRequired'));
      return;
    }
    if (!proxyUrl.toLowerCase().startsWith('https://')) {
      new Notice(t('settingsTab.proxyUrlMustBeHttps'));
      return;
    }
    const progress = new Notice(t('settingsTab.proxyTesting'), 0);
    try {
      // 哑凭证 + 哑请求：只验证"代理能否把请求转发到微信并带回响应"，不涉及真实账号
      const api = new WechatAPI('PROXY_TEST', 'PROXY_TEST', proxyUrl, this.plugin.settings.clientId);
      const testUrl = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=PROXY_TEST&secret=PROXY_TEST';
      const result = await api.sendRequest(testUrl, { method: 'GET' });
      if (result && result.errcode !== undefined) {
        new Notice(t('settingsTab.proxyTestSuccessWithErrcode', { errcode: toText(result.errcode) }), 6000);
      } else {
        new Notice(t('settingsTab.proxyTestConnected'), 5000);
      }
    } catch (error) {
      new Notice(t('settingsTab.proxyTestFailed', { message: toReadableError(error).message }), 9000);
    } finally {
      progress.hide();
    }
  }

  /**
   * 子页面顶部说明（飞书 / 其他平台 页面复用）
   * @param {HTMLElement} containerEl
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
   * @param {AiProviderLike | null} provider
   */
  showEditAiProviderModal(provider) {
    const modal = createObsidianModal(this.app);
    modal.titleEl.setText(provider ? t('settingsTab.editAiProviderTitle') : t('settingsTab.addAiProvider'));

    const form = modal.contentEl.createDiv();

    const nameGroup = form.createDiv({ cls: 'wechat-form-group' });
    nameGroup.createEl('label', { text: t('settingsTab.nameLabel') });
    const nameInput = nameGroup.createEl('input', {
      type: 'text',
      placeholder: t('settingsTab.aiProviderNamePlaceholder'),
      value: provider?.name || ''
    });

    const kindGroup = form.createDiv({ cls: 'wechat-form-group' });
    kindGroup.createEl('label', { text: t('settingsTab.kindLabel') });
    const kindSelectWrap = kindGroup.createDiv({ cls: 'wechat-form-select-wrap' });
    const kindSelect = kindSelectWrap.createEl('select', { cls: 'wechat-form-select' });
    const providerKinds = [
      { value: AI_PROVIDER_KINDS.OPENAI_COMPATIBLE, label: t('settingsTab.aiProviderKindOpenaiCompatible') },
      { value: AI_PROVIDER_KINDS.GEMINI, label: t('settingsTab.aiProviderKindGemini') },
      { value: AI_PROVIDER_KINDS.ANTHROPIC, label: t('settingsTab.aiProviderKindAnthropic') },
    ];
    providerKinds.forEach((kind) => {
      const option = kindSelect.createEl('option', { value: kind.value, text: kind.label });
      if ((provider?.kind || AI_PROVIDER_KINDS.OPENAI_COMPATIBLE) === kind.value) {
        option.selected = true;
      }
    });

    const baseUrlGroup = form.createDiv({ cls: 'wechat-form-group' });
    baseUrlGroup.createEl('label', { text: 'Base URL' });
    const baseUrlInput = baseUrlGroup.createEl('input', {
      type: 'text',
      placeholder: t('settingsTab.aiProviderBaseUrlPlaceholder'),
      value: provider?.baseUrl || 'https://api.deepseek.com/v1'
    });

    const apiKeyGroup = form.createDiv({ cls: 'wechat-form-group' });
    apiKeyGroup.createEl('label', { text: t('settingsTab.apiKeyLabel') });
    const apiKeyInput = apiKeyGroup.createEl('input', {
      type: 'password',
      placeholder: 'sk-...',
      value: provider?.apiKey || ''
    });

    // 模型：Provider 层只标明模型家族一项（见 AI_MODEL_FAMILY_OPTION），不放质量选项。
    const modelGroup = form.createDiv({ cls: 'wechat-form-group' });
    modelGroup.createEl('label', { text: t('settingsTab.modelLabel') });
    const modelSelectWrap = modelGroup.createDiv({ cls: 'wechat-form-select-wrap' });
    const modelSelect = modelSelectWrap.createEl('select', { cls: 'wechat-form-select' });
    const opt = modelSelect.createEl('option', { value: AI_MODEL_FAMILY_OPTION.value, text: AI_MODEL_FAMILY_OPTION.label });
    opt.selected = true;

    const applyKindDefaults = () => {
      const kind = kindSelect.value || AI_PROVIDER_KINDS.OPENAI_COMPATIBLE;
      // 未知类型按 OpenAI 兼容处理
      const baseUrlDefaults = getAiProviderBaseUrlDefaults();
      const defaults = baseUrlDefaults[kind] || baseUrlDefaults[AI_PROVIDER_KINDS.OPENAI_COMPATIBLE];
      baseUrlInput.placeholder = defaults.placeholder;
      if ((!provider || provider.kind !== kind) && !baseUrlInput.value.trim()) {
        baseUrlInput.value = defaults.baseUrl;
      }
    };
    kindSelect.addEventListener('change', applyKindDefaults);
    applyKindDefaults();

    const enabledGroup = form.createDiv({ cls: 'wechat-form-group' });
    enabledGroup.createEl('label', { text: t('settingsTab.enabledLabel') });
    const enabledWrap = enabledGroup.createDiv({ cls: 'wechat-provider-enabled' });
    const enabledLabel = enabledWrap.createEl('label', { cls: 'apple-toggle' });
    const enabledToggle = enabledLabel.createEl('input', { type: 'checkbox', cls: 'apple-toggle-input' });
    enabledToggle.checked = provider?.enabled !== false;
    enabledLabel.createEl('span', { cls: 'apple-toggle-slider' });
    enabledWrap.createEl('span', {
      cls: 'wechat-provider-enabled-text',
      text: t('settingsTab.aiProviderEnabledHint'),
    });

    const btnRow = form.createDiv({ cls: 'wechat-modal-buttons' });
    const cancelBtn = btnRow.createEl('button', { text: t('settingsTab.cancel') });
    cancelBtn.onclick = () => modal.close();

    const testBtn = btnRow.createEl('button', { text: t('settingsTab.testConnection'), cls: 'wechat-btn-test' });
    testBtn.onclick = async () => {
      const candidate = normalizeAiProvider({
        id: provider?.id,
        name: nameInput.value.trim() || t('settingsTab.unnamedAiProvider'),
        kind: kindSelect.value,
        baseUrl: baseUrlInput.value.trim(),
        apiKey: apiKeyInput.value.trim(),
        model: modelSelect.value,
        enabled: enabledToggle.checked,
      });
      const issueSummary = summarizeAiProviderIssues(candidate);
      if (!isAiProviderRunnable(candidate)) {
        new Notice(t('settingsTab.aiProviderIncompleteBeforeTest', { issues: issueSummary }));
        return;
      }
      testBtn.disabled = true;
      testBtn.textContent = t('settingsTab.testing');
      try {
        await testAiProviderConnection(candidate, createObsidianFetchAdapter({ requestUrl: getObsidianRequestUrl(), request: getObsidianRequest() }));
        new Notice(t('settingsTab.connectionSuccess'));
      } catch (error) {
        new Notice(t('settingsTab.connectionFailed', { message: toReadableError(error).message }));
      }
      testBtn.disabled = false;
      testBtn.textContent = t('settingsTab.testConnection');
    };

    const saveBtn = btnRow.createEl('button', { text: t('settingsTab.save'), cls: 'mod-cta' });
    saveBtn.onclick = async () => {
      const nextProvider = normalizeAiProvider({
        id: provider?.id,
        name: nameInput.value.trim() || t('settingsTab.unnamedAiProvider'),
        kind: kindSelect.value,
        baseUrl: baseUrlInput.value.trim(),
        apiKey: apiKeyInput.value.trim(),
        model: modelSelect.value,
        enabled: enabledToggle.checked,
      });

      const issues = getAiProviderIssues(nextProvider).filter((issue) => issue !== 'disabled');
      if (issues.length > 0) {
        new Notice(t('settingsTab.aiProviderIncompleteBeforeSave', { issues: summarizeAiProviderIssues(nextProvider) }));
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
      new Notice(provider ? t('settingsTab.aiProviderUpdated') : t('settingsTab.aiProviderAdded'));
    };

    modal.open();
  }

  /**
   * 显示添加/编辑账号的模态框
   * @param {WechatAccountLike | null} account
   */
  showEditAccountModal(account) {
    const modal = createObsidianModal(this.app);
    modal.titleEl.setText(account ? t('settingsTab.editAccountTitle') : t('settingsTab.addAccount'));

    const form = modal.contentEl.createDiv();
    const publishDefaults = getWechatAccountPublishOptions(account);

    // 账号名称
    const nameGroup = form.createDiv({ cls: 'wechat-form-group' });
    nameGroup.createEl('label', { text: t('settingsTab.accountNameLabel') });
    const nameInput = nameGroup.createEl('input', {
      type: 'text',
      placeholder: t('settingsTab.accountNamePlaceholder'),
      value: account?.name || ''
    });

    // AppID
    const appIdGroup = form.createDiv({ cls: 'wechat-form-group' });
    appIdGroup.createEl('label', { text: t('settingsTab.appIdLabel') });
    const appIdInput = appIdGroup.createEl('input', {
      type: 'text',
      placeholder: 'wx...',
      value: account?.appId || ''
    });

    // AppSecret
    const secretGroup = form.createDiv({ cls: 'wechat-form-group' });
    secretGroup.createEl('label', { text: t('settingsTab.appSecretLabel') });
    const secretInput = secretGroup.createEl('input', {
      type: 'password',
      placeholder: t('settingsTab.appSecretPlaceholder'),
      value: account?.appSecret || ''
    });

    // 默认作者
    const authorGroup = form.createDiv({ cls: 'wechat-form-group' });
    authorGroup.createEl('label', { text: t('settingsTab.defaultAuthorLabel') });
    const authorInput = authorGroup.createEl('input', {
      type: 'text',
      placeholder: t('settingsTab.defaultAuthorPlaceholder'),
      value: account?.author || ''
    });

    const publishOptions = form.createEl('details', { cls: 'wechat-sync-advanced wechat-account-publish-options' });
    publishOptions.createEl('summary', {
      text: t('settingsTab.publishOptionsSummary'),
      cls: 'wechat-sync-advanced-summary',
    });
    const publishSection = publishOptions.createDiv({ cls: 'wechat-sync-advanced-body wechat-account-publish-body' });
    publishSection.createEl('div', {
      text: t('settingsTab.publishOptionsHelp'),
      cls: 'wechat-form-help',
    });

    const sourceUrlGroup = publishSection.createDiv({ cls: 'wechat-form-group' });
    sourceUrlGroup.createEl('label', { text: t('settingsTab.sourceUrlLabel') });
    const sourceUrlInput = sourceUrlGroup.createEl('input', {
      type: 'url',
      placeholder: t('settingsTab.sourceUrlPlaceholder'),
      value: publishDefaults.contentSourceUrl,
    });

    const commentGroup = publishSection.createDiv({ cls: 'wechat-form-checkbox-group' });
    const commentLabel = commentGroup.createEl('label', { cls: 'wechat-form-checkbox-label' });
    const commentInput = commentLabel.createEl('input', { type: 'checkbox' });
    commentInput.checked = publishDefaults.openComment;
    commentLabel.appendText(t('settingsTab.openCommentLabel'));

    const fansCommentGroup = publishSection.createDiv({ cls: 'wechat-form-checkbox-group' });
    const fansCommentLabel = fansCommentGroup.createEl('label', { cls: 'wechat-form-checkbox-label' });
    const fansCommentInput = fansCommentLabel.createEl('input', { type: 'checkbox' });
    fansCommentInput.checked = publishDefaults.openComment && publishDefaults.onlyFansCanComment;
    fansCommentLabel.appendText(t('settingsTab.fansOnlyCommentLabel'));
    fansCommentGroup.createEl('div', {
      text: t('settingsTab.fansOnlyCommentHelp'),
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

    const cancelBtn = btnRow.createEl('button', { text: t('settingsTab.cancel') });
    cancelBtn.onclick = () => modal.close();

    const testBtn = btnRow.createEl('button', { text: t('settingsTab.testConnection'), cls: 'wechat-btn-test' });
    testBtn.onclick = async () => {
      if (!appIdInput.value || !secretInput.value) {
        new Notice(t('settingsTab.appCredentialsRequired'));
        return;
      }
      testBtn.disabled = true;
      testBtn.textContent = t('settingsTab.testing');
      try {
        const api = new WechatAPI(appIdInput.value.trim(), secretInput.value.trim(), this.plugin.settings.proxyUrl, this.plugin.settings.clientId);
        await api.getAccessToken();
        new Notice(t('settingsTab.connectionSuccess'));
      } catch (err) {
        new Notice(t('settingsTab.connectionFailed', { message: toReadableError(err).message }));
      }
      testBtn.disabled = false;
      testBtn.textContent = t('settingsTab.testConnection');
    };

    const saveBtn = btnRow.createEl('button', { text: t('settingsTab.save'), cls: 'mod-cta' });
    saveBtn.onclick = async () => {
      const name = nameInput.value.trim() || t('settingsTab.unnamedAccount');
      const appId = appIdInput.value.trim();
      const appSecret = secretInput.value.trim();

      if (!appId || !appSecret) {
        new Notice(t('settingsTab.appCredentialsRequired'));
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
      new Notice(account ? t('settingsTab.accountUpdated') : t('settingsTab.accountAdded'));
    };

    modal.open();
  }
}
