import { describe, it, expect, beforeEach, vi } from 'vitest';

const obsidian = require('obsidian');
const { __applyExtensions: applyExtensions } = obsidian;
const { renderFeishuSettingsTab } = await import('../views/settings/feishu-tab.js');
const { createDefaultFeishuSyncSettings } = await import('../services/feishu-settings.js');

// Mirror getFeishuApiUsageMonthKey (local YYYY-MM) so the test tracks the real
// "current month" instead of a hardcoded value that breaks when the month rolls.
function currentUsageMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function makeTab() {
  const feishuSync = createDefaultFeishuSyncSettings();
  feishuSync.enabled = true;
  feishuSync.appId = 'cli_test';
  feishuSync.appSecret = 'secret';
  feishuSync.folderToken = 'folder-token';
  feishuSync.uploadHistory = [{
    title: '飞书测试',
    url: 'https://feishu.cn/docx/doc-token',
    uploadTime: '2026-06-21T00:00:00Z',
    docToken: 'doc-token',
    sourcePath: 'notes/feishu.md',
  }];
  feishuSync.apiUsage = {
    month: currentUsageMonthKey(),
    count: 64,
    updatedAt: 123,
  };

  // 3.10.0：飞书是设置面板的子页面，renderFeishuSettingsTab 只需要 tab.plugin，
  // 开关变化后原地重绘传入的 containerEl，不再回调 tab.display()
  return {
    plugin: {
      settings: { feishuSync },
      saveSettings: vi.fn(async () => undefined),
      openExternalUrl: vi.fn(),
      obsidianApi: obsidian,
    },
  };
}

function findControl(settingName) {
  return globalThis.__obsidianControlRegistry.find((control) => control.settingName === settingName);
}

describe('Feishu settings tab', () => {
  beforeEach(() => {
    globalThis.__obsidianNoticeRegistry = [];
    globalThis.__obsidianControlRegistry = [];
  });

  it('re-renders its own container (not the whole tab) when the enable toggle changes', async () => {
    const tab = makeTab();
    const containerEl = applyExtensions(document.createElement('div'));

    renderFeishuSettingsTab(tab, containerEl, { obsidianApi: obsidian });
    expect(containerEl.textContent).toContain('本月 API 调用次数');

    const enableToggle = findControl('启用飞书同步功能');
    expect(enableToggle).toBeDefined();
    expect(enableToggle.value).toBe(true);

    await enableToggle.changeHandler(false);

    expect(tab.plugin.settings.feishuSync.enabled).toBe(false);
    expect(tab.plugin.saveSettings).toHaveBeenCalledTimes(1);
    // 关闭后：本页只剩开关，统计卡片与凭证输入消失；且是同一个容器被重绘
    expect(containerEl.textContent).not.toContain('本月 API 调用次数');
    expect(containerEl.textContent).toContain('启用飞书同步功能');
    expect(containerEl.querySelectorAll('.wechat-feishu-usage-card')).toHaveLength(0);
  });

  it('renders monthly API usage stats and resets them from the Feishu tab', async () => {
    const tab = makeTab();
    const containerEl = applyExtensions(document.createElement('div'));

    renderFeishuSettingsTab(tab, containerEl, { obsidianApi: obsidian });

    expect(containerEl.textContent).toContain('本月 API 调用次数');
    expect(containerEl.textContent).toContain('您已成功分享 1 个文档');
    expect(containerEl.textContent).toContain('64 / 10,000');
    expect(containerEl.textContent).toContain('剩余约 9,936 次');
    expect(containerEl.textContent).toContain('统计周期：' + currentUsageMonthKey());

    const resetButton = Array.from(containerEl.querySelectorAll('button'))
      .find((button) => button.textContent === '重置计数');
    expect(resetButton).toBeDefined();

    await resetButton.onclick();

    expect(tab.plugin.settings.feishuSync.apiUsage.count).toBe(0);
    expect(tab.plugin.saveSettings).toHaveBeenCalledTimes(1);
    expect(globalThis.__obsidianNoticeRegistry.at(-1).message).toBe('✅ 飞书 API 调用计数已重置');
    expect(containerEl.textContent).toContain('0 / 10,000');
  });
});
