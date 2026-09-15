// 顶栏按钮按模式显隐的回归测试：
// 3.11.0 把模式切换改成 is-hidden 类切换后，小红书按钮创建时仍用内联 display:none 隐藏，
// 类切换清不掉内联样式 → 小红书模式下「样式设置 / 下载」按钮消失。
// 契约：初始隐藏与模式切换必须用同一种机制（is-hidden 类），不得写内联 display。
import { describe, it, expect, vi, afterEach } from 'vitest';

const fs = require('fs');
const path = require('path');
const { loadInputModule } = require('./helpers/input-module.cjs');
// 顶栏设置层读取主题/配色列表，需先定义 window.AppleTheme（与 callout.test.js 同法）
eval(fs.readFileSync(path.resolve(__dirname, '../themes/apple-theme.js'), 'utf-8'));
const { createObsidianLikeElement } = require('./helpers/obsidian-dom.js');
const inputModule = loadInputModule();
const { AppleStyleView } = inputModule;
const { DEFAULT_SETTINGS } = await import('../services/settings-defaults.js');

function buildView() {
  const view = new AppleStyleView(null, { settings: { ...DEFAULT_SETTINGS }, manifest: { id: 'note-content-studio' } });
  view.app = { workspace: { getActiveViewOfType: vi.fn(() => null) } };
  const container = createObsidianLikeElement('div');
  view.createSettingsPanel(container);
  return { view, container };
}

describe('顶栏按钮按模式显隐', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('初始(公众号模式)：小红书按钮用 is-hidden 类隐藏，且没有内联 display', () => {
    const { view } = buildView();
    for (const btn of [view.rednoteSettingsBtn, view.rednoteDownloadBtn]) {
      expect(btn.classList.contains('is-hidden')).toBe(true);
      expect(btn.style.display).toBe('');
    }
    for (const btn of [view.settingsBtn, view.aiLayoutBtn, view.copyBtn]) {
      expect(btn.classList.contains('is-hidden')).toBe(false);
      expect(btn.style.display).toBe('');
    }
  });

  it('applyToolbarMode：小红书/X 模式显示图卡按钮、隐藏公众号按钮；切回公众号恢复', () => {
    const { view } = buildView();
    for (const mode of ['rednote', 'x']) {
      view.applyToolbarMode(mode);
      for (const btn of [view.rednoteSettingsBtn, view.rednoteDownloadBtn]) {
        expect(btn.classList.contains('is-hidden')).toBe(false);
      }
      for (const btn of [view.settingsBtn, view.aiLayoutBtn, view.copyBtn]) {
        expect(btn.classList.contains('is-hidden')).toBe(true);
      }
    }
    view.applyToolbarMode('wechat');
    for (const btn of [view.rednoteSettingsBtn, view.rednoteDownloadBtn]) {
      expect(btn.classList.contains('is-hidden')).toBe(true);
    }
    for (const btn of [view.settingsBtn, view.aiLayoutBtn, view.copyBtn]) {
      expect(btn.classList.contains('is-hidden')).toBe(false);
    }
  });
});
