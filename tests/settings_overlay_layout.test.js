// tests/settings_overlay_layout.test.js
//
// 3.12.0：手机仿真框与图片水印从插件设置页挪到预览悬浮层「高级选项」，且即时生效（不再"重开面板生效"）。
import { describe, it, expect, vi, beforeEach } from 'vitest';
const { loadInputModule } = require('./helpers/input-module.cjs');
const { createObsidianLikeElement } = require('./helpers/obsidian-dom.js');

const inputModule = loadInputModule();
const { AppleStyleView } = inputModule;

function makeView(overrides = {}) {
  const view = new AppleStyleView(null, {
    settings: {
      theme: 'github',
      themeColor: 'blue',
      customColor: '#0366d6',
      fontFamily: 'sans-serif',
      fontSize: 3,
      coloredHeader: false,
      macCodeBlock: true,
      codeLineNumber: true,
      sidePadding: 16,
      showImageCaption: true,
      enableWatermark: false,
      usePhoneFrame: true,
      avatarBase64: '',
      avatarUrl: '',
      ...overrides,
    },
    saveSettings: vi.fn(async () => true),
  });
  view.app = { isMobile: false };
  view.theme = { update: vi.fn() };
  view.converter = { updateConfig: vi.fn() };
  view.convertCurrent = vi.fn(async () => {});
  global.AppleTheme = {
    getThemeList: () => [{ value: 'github', label: '简约' }],
    getColorList: () => [{ value: 'blue', color: '#0366d6' }],
  };
  const container = createObsidianLikeElement();
  view.createSettingsPanel(container);
  return { view, container };
}

function findSection(container, label) {
  return Array.from(container.querySelectorAll('.apple-setting-section'))
    .find((section) => section.querySelector('.apple-setting-label')?.textContent === label) || null;
}

describe('预览悬浮层 · 高级选项里的手机仿真框与图片水印', () => {
  beforeEach(() => {
    globalThis.__obsidianNoticeRegistry = [];
  });

  it('高级选项里出现「手机仿真框」与「图片水印」两个区块', () => {
    const { container } = makeView();
    expect(findSection(container, '手机仿真框')).toBeTruthy();
    const watermark = findSection(container, '图片水印');
    expect(watermark).toBeTruthy();
    expect(watermark.querySelector('.apple-text-input')).toBeTruthy();
    expect(watermark.querySelector('.apple-settings-avatar-row')).toBeTruthy();
  });

  it('切换手机仿真框：保存设置并即时切换预览区 wrapper 的类', async () => {
    const { view, container } = makeView();
    const wrapper = createObsidianLikeElement('div');
    wrapper.addClass('apple-preview-wrapper');
    wrapper.addClass('mode-phone');
    view.previewWrapper = wrapper;
    const checkbox = findSection(container, '手机仿真框').querySelector('input.apple-toggle-input');
    expect(checkbox.checked).toBe(true);

    checkbox.checked = false;
    await view.onUsePhoneFrameChange(false);
    expect(view.plugin.settings.usePhoneFrame).toBe(false);
    expect(view.plugin.saveSettings).toHaveBeenCalledTimes(1);
    expect(wrapper.classList.contains('mode-classic')).toBe(true);
    expect(wrapper.classList.contains('mode-phone')).toBe(false);

    await view.onUsePhoneFrameChange(true);
    expect(wrapper.classList.contains('mode-phone')).toBe(true);
  });

  it('开启水印：更新转换器头像、重渲染，并把「显示图片说明文字」固定开启置灰；关闭后恢复', async () => {
    const { view, container } = makeView({ avatarUrl: 'https://example.com/a.png' });
    const caption = findSection(container, '显示图片说明文字');
    const captionCheckbox = caption.querySelector('input.apple-toggle-input');
    expect(captionCheckbox.disabled).toBe(false);

    await view.onEnableWatermarkChange(true);
    expect(view.plugin.settings.enableWatermark).toBe(true);
    expect(view.converter.updateConfig).toHaveBeenCalledWith({ avatarUrl: 'https://example.com/a.png' });
    expect(view.convertCurrent).toHaveBeenCalledWith(true);
    expect(captionCheckbox.disabled).toBe(true);
    expect(captionCheckbox.checked).toBe(true);
    expect(caption.querySelector('.apple-setting-content > span').textContent).toContain('固定开启');

    await view.onEnableWatermarkChange(false);
    expect(view.converter.updateConfig).toHaveBeenLastCalledWith({ avatarUrl: '' });
    expect(captionCheckbox.disabled).toBe(false);
  });

  it('清除本地头像与修改备用 URL 都即时落到设置并重渲染', async () => {
    const { view } = makeView({ enableWatermark: true, avatarBase64: 'data:image/png;base64,AAA' });
    await view.onClearLocalAvatar();
    expect(view.plugin.settings.avatarBase64).toBe('');
    expect(globalThis.__obsidianNoticeRegistry.at(-1).message).toContain('已清除');

    await view.onAvatarUrlChange('  https://example.com/b.png ');
    expect(view.plugin.settings.avatarUrl).toBe('https://example.com/b.png');
    expect(view.converter.updateConfig).toHaveBeenLastCalledWith({ avatarUrl: 'https://example.com/b.png' });
  });
});
