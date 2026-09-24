// 切换文档时按 frontmatter platform 自动切换预览平台（3.11.16）：
// 设置默认开；命中且与当前模式不同才调 setPreviewMode；无属性 / 不认识 / 已是该模式 / 设置关 → 不动。
import { describe, it, expect, vi, afterEach } from 'vitest';

const fs = require('fs');
const path = require('path');
const { loadInputModule } = require('./helpers/input-module.cjs');
eval(fs.readFileSync(path.resolve(__dirname, '../themes/apple-theme.js'), 'utf-8'));
const inputModule = loadInputModule();
const { AppleStyleView } = inputModule;
const { DEFAULT_SETTINGS } = await import('../services/settings-defaults.js');

function buildView(frontmatter, settings = {}) {
  const view = new AppleStyleView(null, { settings: { ...DEFAULT_SETTINGS, ...settings }, manifest: { id: 'note-content-studio' } });
  view.app = {
    workspace: { getActiveViewOfType: vi.fn(() => null) },
    metadataCache: { getFileCache: vi.fn(() => (frontmatter === undefined ? null : { frontmatter })) },
  };
  view.setPreviewMode = vi.fn(async () => {});
  return view;
}

describe('按文档属性自动切换预览平台', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('默认开启：platform: 小红书 → 切到 rednote', () => {
    const view = buildView({ platform: '小红书' });
    expect(DEFAULT_SETTINGS.autoSwitchPlatformByProperty).toBe(true);
    expect(view.syncPreviewModeWithFile({ path: 'a.md' })).toBe('rednote');
    expect(view.setPreviewMode).toHaveBeenCalledWith('rednote');
  });

  it('已经是该模式 → 不重复切换', () => {
    const view = buildView({ platform: 'wechat' });
    expect(view._previewMode).toBe('wechat');
    expect(view.syncPreviewModeWithFile({ path: 'a.md' })).toBeNull();
    expect(view.setPreviewMode).not.toHaveBeenCalled();
  });

  it('没有属性 / 值不认识 / 没有 cache → 保持当前模式', () => {
    for (const fm of [{}, { platform: 'iOS' }, undefined]) {
      const view = buildView(fm);
      view._previewMode = 'rednote';
      expect(view.syncPreviewModeWithFile({ path: 'a.md' })).toBeNull();
      expect(view.setPreviewMode).not.toHaveBeenCalled();
    }
  });

  it('设置关闭 → 完全不读属性', () => {
    const view = buildView({ platform: 'x' }, { autoSwitchPlatformByProperty: false });
    expect(view.syncPreviewModeWithFile({ path: 'a.md' })).toBeNull();
    expect(view.app.metadataCache.getFileCache).not.toHaveBeenCalled();
    expect(view.setPreviewMode).not.toHaveBeenCalled();
  });

  it('文件为空 → 不动', () => {
    const view = buildView({ platform: 'x' });
    expect(view.syncPreviewModeWithFile(null)).toBeNull();
    expect(view.setPreviewMode).not.toHaveBeenCalled();
  });
});
