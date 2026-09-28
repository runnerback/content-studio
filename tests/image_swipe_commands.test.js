import { describe, it, expect, afterEach } from 'vitest';
const { loadInputModule } = require('./helpers/input-module.cjs');

const {
  default: AppleStylePlugin,
  createImageSwipeCalloutMarkdown,
  getImageSwipeCommandCopy,
} = loadInputModule();
const obsidian = require('obsidian');
const { resetLocaleCache } = require('../services/i18n.js');

// 3.12.0：文案随 Obsidian 语言（getLanguage）切换，不再读 vault 的 language 配置
const originalGetLanguage = obsidian.getLanguage;
function useLanguage(code) {
  obsidian.getLanguage = () => code;
  resetLocaleCache();
}

describe('Image swipe editor commands', () => {
  afterEach(() => {
    obsidian.getLanguage = originalGetLanguage;
    resetLocaleCache();
  });

  it('should wrap selected images in an image-swipe callout', () => {
    useLanguage('zh');
    const selected = [
      '![[png1.png]]',
      '![[png2.png]]',
    ].join('\n');

    const markdown = createImageSwipeCalloutMarkdown('image-swipe', selected);

    expect(markdown).toBe([
      '> [!image-swipe] 左右滑动查看图片',
      '> ![[png1.png]]',
      '> ![[png2.png]]',
    ].join('\n'));
  });

  it('should insert an image-sensitive template when nothing is selected', () => {
    useLanguage('zh-TW');
    const markdown = createImageSwipeCalloutMarkdown('image-sensitive', '');

    expect(markdown).toContain('> [!image-sensitive] 此类图片可能引发不适，向左滑动查看');
    expect(markdown).toContain('> ![[图片1.png]]');
    expect(markdown).toContain('> ![[图片2.png]]');
  });

  it('command names follow the interface language (Chinese / English)', () => {
    useLanguage('zh');
    expect(getImageSwipeCommandCopy('image-swipe').name).toBe('插入横滑图片块');
    expect(getImageSwipeCommandCopy('image-sensitive').name).toBe('插入横滑敏感图片块');

    useLanguage('en');
    expect(getImageSwipeCommandCopy('image-swipe').name).toBe('Insert swipe image block');
    expect(getImageSwipeCommandCopy('image-sensitive').notice).toBe('Sensitive image block inserted');
  });

  it('should keep generated templates localized for non-Chinese Obsidian locales', () => {
    useLanguage('en');
    const markdown = createImageSwipeCalloutMarkdown('image-swipe', '');

    expect(markdown).toContain('> [!image-swipe] Swipe to view images');
    expect(markdown).toContain('> ![[image-1.png]]');
    expect(markdown).toContain('> ![[image-2.png]]');
  });

  it('should register image swipe commands as always-visible command palette actions', async () => {
    useLanguage('zh');
    const commands = [];
    const editor = {
      getSelection: () => '![[a.png]]\n![[b.png]]',
      replaceSelection: (value) => {
        editor.inserted = value;
      },
    };
    const plugin = new AppleStylePlugin();
    plugin.app = {
      vault: { getConfig: () => 'zh-CN' },
      workspace: {
        getActiveViewOfType: () => ({ editor }),
        getLeavesOfType: () => [],
        onLayoutReady: () => {},
      },
    };
    plugin.loadData = async () => ({});
    plugin.saveData = async () => {};
    plugin.registerView = () => {};
    plugin.addRibbonIcon = () => {};
    plugin.addCommand = (command) => commands.push(command);
    plugin.addSettingTab = () => {};
    plugin.startWechatSyncBridgeInBackground = () => {};

    await plugin.onload();

    const imageCommand = commands.find((command) => command.id === 'insert-image-swipe-block');
    const sensitiveCommand = commands.find((command) => command.id === 'insert-image-sensitive-block');
    const openCommand = commands.find((command) => command.id === 'open-apple-converter');

    expect(imageCommand?.name).toBe('插入横滑图片块');
    expect(sensitiveCommand?.name).toBe('插入横滑敏感图片块');
    expect(openCommand?.name).toBe('打开预览面板');

    imageCommand.callback();
    expect(editor.inserted).toContain('> [!image-swipe] 左右滑动查看图片');
    expect(editor.inserted).toContain('> ![[a.png]]');
  });
});
