// views/settings/feishu-tab.js
//
// Renders the「飞书」settings tab in the AppleStyleSettingTab.
// Extracted to keep input.js clean and maintain separation of concerns.
// Uses Obsidian APIs (Setting, Notice, etc.).

import { getActiveWindowValue } from '../../services/dom-utils.js';
import { FeishuApiClient } from '../../services/feishu-api.js';
import {
  FEISHU_FREE_MONTHLY_API_LIMIT,
  incrementFeishuApiUsage,
  normalizeFeishuSyncSettings,
  resetFeishuApiUsage,
} from '../../services/feishu-settings.js';
import { t } from '../../services/i18n.js';
import { toReadableError, toRecord } from '../../services/input-utils.js';

/**
 * @typedef {import('../../services/feishu-settings.js').FeishuSyncSettingsLike} FeishuSyncSettingsLike
 * @typedef {import('../../services/feishu-api.js').FeishuRequestUrlLike} FeishuRequestUrlLike
 * @typedef {{ setValue: (value: boolean) => FeishuToggleLike, onChange: (callback: (value: boolean) => unknown) => FeishuToggleLike }} FeishuToggleLike
 * @typedef {{ inputEl: HTMLInputElement, setPlaceholder: (value: string) => FeishuTextLike, setValue: (value: string) => FeishuTextLike, onChange: (callback: (value: string) => unknown) => FeishuTextLike }} FeishuTextLike
 * @typedef {{ setButtonText: (value: string) => FeishuButtonLike, onClick: (callback: () => unknown) => FeishuButtonLike }} FeishuButtonLike
 * @typedef {{ setName: (value: string) => FeishuSettingLike, setDesc: (value: string) => FeishuSettingLike, addToggle: (callback: (toggle: FeishuToggleLike) => unknown) => FeishuSettingLike, addText: (callback: (text: FeishuTextLike) => unknown) => FeishuSettingLike, addButton: (callback: (button: FeishuButtonLike) => unknown) => FeishuSettingLike }} FeishuSettingLike
 * @typedef {new (containerEl: HTMLElement) => FeishuSettingLike} FeishuSettingConstructor
 * @typedef {{ hide: () => unknown }} FeishuNoticeLike
 * @typedef {new (message: string, duration?: number) => FeishuNoticeLike} FeishuNoticeConstructor
 * @typedef {{ Setting: FeishuSettingConstructor, Notice: FeishuNoticeConstructor, requestUrl?: FeishuRequestUrlLike }} FeishuObsidianApiLike
 * @typedef {{ settings: { feishuSync?: unknown, [key: string]: unknown }, saveSettings: () => Promise<unknown>, openExternalUrl?: (url: string) => boolean, obsidianApi?: unknown }} FeishuSettingsPluginLike
 * @typedef {{ plugin: FeishuSettingsPluginLike, renderSettingsTabIntro?: (containerEl: HTMLElement, description: string) => void }} FeishuSettingsTabLike
 */

/**
 * @param {number} value
 * @returns {string}
 */
function formatFeishuUsageNumber(value) {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('zh-CN');
}

/**
 * @param {number} count
 * @param {number} limit
 * @returns {string}
 */
function formatFeishuUsagePercent(count, limit) {
  if (!limit) return '0%';
  return `${Math.min(100, Math.round((count / limit) * 100))}%`;
}

/**
 * @param {HTMLDivElement} containerEl
 * @param {FeishuSettingsTabLike} tab
 * @param {FeishuSettingsPluginLike} plugin
 * @param {FeishuSyncSettingsLike} settings
 * @param {FeishuObsidianApiLike} obsidian
 * @param {FeishuNoticeConstructor | undefined} Notice
 * @returns {void}
 */
function renderFeishuUsageStats(containerEl, tab, plugin, settings, obsidian, Notice) {
  const usage = settings.apiUsage;
  const used = Math.max(0, Number(usage.count) || 0);
  const limit = FEISHU_FREE_MONTHLY_API_LIMIT;
  const remaining = Math.max(0, limit - used);
  const percent = Math.min(100, limit ? (used / limit) * 100 : 0);

  const card = containerEl.createDiv({ cls: 'wechat-feishu-usage-card' });
  card.setCssStyles({
    margin: '18px 0 22px',
    padding: '18px 20px',
    border: '1px solid var(--background-modifier-border)',
    borderRadius: '12px',
    background: 'var(--background-secondary)',
  });

  const header = card.createDiv({ cls: 'wechat-feishu-usage-header' });
  header.setCssStyles({
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  });

  const copy = header.createDiv();
  copy.createEl('div', { text: t('feishu.statsHeading'), cls: 'setting-item-heading' });
  const sharedCount = Array.isArray(settings.uploadHistory) ? settings.uploadHistory.length : 0;
  const shareTitle = copy.createEl('div', { text: t('feishu.sharedDocsName'), cls: 'setting-item-name' });
  shareTitle.setCssStyles({ marginTop: '10px' });
  copy.createEl('div', {
    text: t('feishu.sharedDocsDesc', { count: formatFeishuUsageNumber(sharedCount) }),
    cls: 'setting-item-description',
  });
  const title = copy.createEl('div', { text: t('feishu.apiUsageName'), cls: 'setting-item-name' });
  title.setCssStyles({ marginTop: '16px' });
  copy.createEl('div', {
    text: t('feishu.apiUsageDesc', {
      used: formatFeishuUsageNumber(used),
      limit: formatFeishuUsageNumber(limit),
      remaining: formatFeishuUsageNumber(remaining),
    }),
    cls: 'setting-item-description',
  });

  const resetBtn = header.createEl('button', { text: t('feishu.resetUsageButton') });
  resetBtn.addClass('mod-warning');
  resetBtn.onclick = async () => {
    resetFeishuApiUsage(settings);
    await plugin.saveSettings();
    if (Notice) new Notice(t('feishu.resetUsageNotice'));
    renderFeishuSettingsTab(tab, containerEl, { obsidianApi: obsidian });
  };

  const progressTrack = card.createDiv({ cls: 'wechat-feishu-usage-progress' });
  progressTrack.setCssStyles({
    height: '8px',
    marginTop: '14px',
    borderRadius: '999px',
    overflow: 'hidden',
    background: 'var(--background-modifier-border)',
  });
  const progressBar = progressTrack.createDiv();
  progressBar.setCssStyles({
    width: formatFeishuUsagePercent(used, limit),
    height: '100%',
    borderRadius: '999px',
    background: percent >= 90 ? 'var(--text-error)' : 'var(--interactive-accent)',
  });

  card.createEl('p', {
    text: t('feishu.usagePeriodNote', { month: usage.month }),
    cls: 'setting-item-description',
  }).setCssStyles({ marginTop: '10px' });
}

/**
 * Renders the Feishu Sync settings inside the settings tab.
 * @param {FeishuSettingsTabLike} tab AppleStyleSettingTab instance
 * @param {HTMLDivElement} containerEl settings tab sub-container
 * @param {{ obsidianApi?: FeishuObsidianApiLike }} [options={}] Injected options
 */
function renderFeishuSettingsTab(tab, containerEl, options = {}) {
  // 注入的 obsidianApi 优先；否则回落到插件持有的 obsidian 模块或窗口全局
  const obsidian = options.obsidianApi
    || /** @type {FeishuObsidianApiLike} */ (toRecord(tab.plugin.obsidianApi || getActiveWindowValue('obsidian')));
  const Setting = obsidian.Setting;
  const Notice = obsidian.Notice;

  const { plugin } = tab;
  const settings = normalizeFeishuSyncSettings(plugin.settings.feishuSync);
  plugin.settings.feishuSync = settings;

  containerEl.empty();

  if (typeof tab.renderSettingsTabIntro === 'function') {
    tab.renderSettingsTabIntro(
      containerEl,
      t('feishu.intro')
    );
  }

  containerEl.createEl('h2', { text: t('feishu.heading'), cls: 'wechat-feishu-heading' });
  containerEl.createEl('p', {
    text: t('feishu.headingDesc'),
    cls: 'setting-item-description',
  });

  // 1. Enable Toggle
  new Setting(containerEl)
    .setName(t('feishu.enableName'))
    .setDesc(t('feishu.enableDesc'))
    .addToggle((toggle) => toggle
      .setValue(settings.enabled)
      .onChange(async (value) => {
        settings.enabled = value;
        await plugin.saveSettings();
        // 飞书已是独立子页面：只重绘本页容器，不再重绘整个设置面板
        renderFeishuSettingsTab(tab, containerEl, { obsidianApi: obsidian });
      })
    );

  if (!settings.enabled) return;

  renderFeishuUsageStats(containerEl, tab, plugin, settings, obsidian, Notice);

  // 2. App ID
  new Setting(containerEl)
    .setName(t('feishu.appIdName'))
    .setDesc(t('feishu.appIdDesc'))
    .addText((text) => text
      .setPlaceholder(t('feishu.appIdPlaceholder'))
      .setValue(settings.appId)
      .onChange(async (value) => {
        settings.appId = value.trim();
        await plugin.saveSettings();
      })
    );

  // 3. App Secret
  new Setting(containerEl)
    .setName(t('feishu.appSecretName'))
    .setDesc(t('feishu.appSecretDesc'))
    .addText((text) => {
      text.inputEl.type = 'password'; // mask the password input
      text
        .setPlaceholder(t('feishu.appSecretPlaceholder'))
        .setValue(settings.appSecret)
        .onChange(async (value) => {
          settings.appSecret = value.trim();
          await plugin.saveSettings();
        });
    });

  // 4. Folder Token
  new Setting(containerEl)
    .setName(t('feishu.folderTokenName'))
    .setDesc(t('feishu.folderTokenDesc'))
    .addText((text) => text
      .setPlaceholder(t('feishu.folderTokenPlaceholder'))
      .setValue(settings.folderToken)
      .onChange(async (value) => {
        settings.folderToken = value.trim();
        await plugin.saveSettings();
      })
    );

  // 5. User ID
  new Setting(containerEl)
    .setName(t('feishu.userIdName'))
    .setDesc(t('feishu.userIdDesc'))
    .addText((text) => text
      .setPlaceholder(t('feishu.userIdPlaceholder'))
      .setValue(settings.userId)
      .onChange(async (value) => {
        settings.userId = value.trim();
        await plugin.saveSettings();
      })
    );

  // 6. Test Connection Button
  new Setting(containerEl)
    .setName(t('feishu.testConnectionName'))
    .setDesc(t('feishu.testConnectionDesc'))
    .addButton((btn) => btn
      .setButtonText(t('feishu.testConnectionButton'))
      .onClick(async () => {
        if (!settings.appId || !settings.appSecret) {
          new Notice(t('feishu.noticeMissingCredentials'));
          return;
        }
        if (!settings.folderToken) {
          new Notice(t('feishu.noticeMissingFolderToken'));
          return;
        }

        const notice = new Notice(t('feishu.noticeTesting'), 0);
        try {
          let apiUsageChanged = false;
          const client = new FeishuApiClient(settings.appId, settings.appSecret, obsidian.requestUrl, {
            onApiCall: () => {
              incrementFeishuApiUsage(settings);
              apiUsageChanged = true;
            },
          });

          // Verify authentication token
          await client.getAccessToken();

          // Verify folder read access
          await client.listFolderItems(settings.folderToken);

          notice.hide();
          if (apiUsageChanged) await plugin.saveSettings();
          new Notice(t('feishu.noticeTestSuccess'));
        } catch (err) {
          notice.hide();
          await plugin.saveSettings();
          console.error('[飞书连接测试失败]:', err);
          new Notice(t('feishu.noticeTestFailed', { message: toReadableError(err).message }), 7000);
        }
      })
    );

  // 7. Render setup instructions
  const guideCard = containerEl.createDiv({ cls: 'wechat-feishu-guide-card' });
  guideCard.setCssStyles({
    margin: '24px 0',
    padding: '20px',
    border: '1px solid var(--background-modifier-border-hover)',
    borderRadius: '8px',
    background: 'var(--background-secondary)',
    boxShadow: 'var(--shadow-s)',
  });

  // Title
  const titleEl = guideCard.createEl('h3', { cls: 'guide-card-title' });
  titleEl.setText(t('feishu.guideTitle'));
  titleEl.setCssStyles({
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--text-normal)',
    margin: '0 0 12px 0',
  });

  // Steps list
  const stepsContainer = guideCard.createDiv({ cls: 'guide-steps-list' });
  stepsContainer.setCssStyles({
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  });

  /**
   * Helper function to render a step item
   * @param {number} num
   * @param {(body: HTMLDivElement) => void} contentFn
   */
  const renderStep = (num, contentFn) => {
    const stepRow = stepsContainer.createDiv();
    stepRow.setCssStyles({
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
    });

    const badge = stepRow.createSpan();
    badge.setText(num.toString());
    badge.setCssStyles({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      background: 'var(--interactive-accent)',
      color: 'var(--text-on-interactive-accent, #ffffff)',
      fontSize: '11px',
      fontWeight: 'bold',
      flexShrink: '0',
      marginTop: '2px',
    });

    const body = stepRow.createDiv();
    body.setCssStyles({
      fontSize: '13px',
      lineHeight: '1.6',
      color: 'var(--text-normal)',
      flexGrow: '1',
    });

    contentFn(body);
  };

  // Step 1
  renderStep(1, (body) => {
    body.createSpan({ text: t('feishu.step1Before') });
    const link = body.createEl('a', { text: t('feishu.step1Link'), href: 'https://open.feishu.cn/' });
    link.onclick = (e) => {
      e.preventDefault();
      if (plugin && typeof plugin.openExternalUrl === 'function') {
        plugin.openExternalUrl('https://open.feishu.cn/');
      } else {
        window.open('https://open.feishu.cn/', '_blank', 'noopener');
      }
    };
    link.setCssStyles({ color: 'var(--text-accent)', textDecoration: 'underline' });
    body.createSpan({ text: t('feishu.step1After') });
  });

  // Step 2
  renderStep(2, (body) => {
    body.createSpan({ text: t('feishu.step2') });
    const subList = body.createDiv();
    subList.setCssStyles({
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      marginTop: '8px',
      paddingLeft: '12px',
      borderLeft: '2px solid var(--interactive-accent)',
    });

    /**
     * @param {string} codeText
     * @param {string} descText
     */
    const addSubItem = (codeText, descText) => {
      const item = subList.createDiv();
      item.setCssStyles({ display: 'flex', alignItems: 'center', gap: '6px' });

      const code = item.createEl('code', { text: codeText });
      code.setCssStyles({
        fontFamily: 'var(--font-monospace)',
        fontSize: '12px',
        padding: '2px 6px',
        background: 'var(--background-primary)',
        border: '1px solid var(--background-modifier-border)',
        borderRadius: '4px',
        color: 'var(--code-normal)',
      });

      const desc = item.createSpan({ text: descText });
      desc.setCssStyles({ color: 'var(--text-muted)', fontSize: '12px' });
    };

    addSubItem(t('feishu.step2AppScopeCode'), t('feishu.step2AppScopeDesc'));
    addSubItem(t('feishu.step2UserScopeCode'), t('feishu.step2UserScopeDesc'));
    addSubItem(t('feishu.step2MinScopeCode'), t('feishu.step2MinScopeDesc'));
  });

  // Step 3
  renderStep(3, (body) => {
    body.createSpan({ text: t('feishu.step3Before') });
    const strong = body.createEl('strong', { text: t('feishu.step3Strong') });
    strong.setCssStyles({ color: 'var(--text-accent)' });
    body.createSpan({ text: t('feishu.step3After') });
  });
}

export {
  renderFeishuSettingsTab,
};
