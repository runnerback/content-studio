// frontmatter `platform` → 预览模式：接受 wechat/rednote/x、下拉框中文标签与常见别名；其余一律 null（不误切）。
import { describe, it, expect } from 'vitest';
import { resolvePreviewModeFromFrontmatter, PLATFORM_PROPERTY_KEY } from '../services/platform-property.js';

describe('resolvePreviewModeFromFrontmatter', () => {
  it('三个标准值', () => {
    expect(resolvePreviewModeFromFrontmatter({ platform: 'wechat' })).toBe('wechat');
    expect(resolvePreviewModeFromFrontmatter({ platform: 'rednote' })).toBe('rednote');
    expect(resolvePreviewModeFromFrontmatter({ platform: 'x' })).toBe('x');
  });
  it('中文标签与别名、大小写与空白', () => {
    expect(resolvePreviewModeFromFrontmatter({ platform: '公众号' })).toBe('wechat');
    expect(resolvePreviewModeFromFrontmatter({ platform: '小红书' })).toBe('rednote');
    expect(resolvePreviewModeFromFrontmatter({ platform: 'X' })).toBe('x');
    expect(resolvePreviewModeFromFrontmatter({ platform: ' xiaohongshu ' })).toBe('rednote');
    expect(resolvePreviewModeFromFrontmatter({ platform: 'Twitter' })).toBe('x');
  });
  it('数组取第一个', () => {
    expect(resolvePreviewModeFromFrontmatter({ platform: ['rednote', 'x'] })).toBe('rednote');
  });
  it('不认识 / 缺失 / 非字符串 → null', () => {
    expect(resolvePreviewModeFromFrontmatter({ platform: 'iOS' })).toBeNull();
    expect(resolvePreviewModeFromFrontmatter({ platform: 3 })).toBeNull();
    expect(resolvePreviewModeFromFrontmatter({})).toBeNull();
    expect(resolvePreviewModeFromFrontmatter(null)).toBeNull();
    expect(resolvePreviewModeFromFrontmatter(undefined)).toBeNull();
    expect(PLATFORM_PROPERTY_KEY).toBe('platform');
  });
});
