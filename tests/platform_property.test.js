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

// 3.12.0：platform 支持数组（一稿多发），resolvePlatformTargetsFromFrontmatter 给全部目标；预览模式取第一个能识别的
import { resolvePlatformTargetsFromFrontmatter } from '../services/platform-property.js';

describe('resolvePlatformTargetsFromFrontmatter', () => {
  it('数组：去重、保持顺序、跳过不认识的值', () => {
    expect(resolvePlatformTargetsFromFrontmatter({ platform: ['rednote', 'x'] })).toEqual(['rednote', 'x']);
    expect(resolvePlatformTargetsFromFrontmatter({ platform: ['小红书', 'xiaohongshu', 'iOS', 'X'] })).toEqual(['rednote', 'x']);
    expect(resolvePlatformTargetsFromFrontmatter({ platform: ['公众号', 'rednote', 'wechat'] })).toEqual(['wechat', 'rednote']);
  });
  it('字符串视为单元素；缺失 / 全不认识 → 空数组', () => {
    expect(resolvePlatformTargetsFromFrontmatter({ platform: 'wechat' })).toEqual(['wechat']);
    expect(resolvePlatformTargetsFromFrontmatter({ platform: ['iOS', 3] })).toEqual([]);
    expect(resolvePlatformTargetsFromFrontmatter({})).toEqual([]);
    expect(resolvePlatformTargetsFromFrontmatter(null)).toEqual([]);
  });
  it('预览模式取第一个能识别的（跳过前面的无效值）', () => {
    expect(resolvePreviewModeFromFrontmatter({ platform: ['iOS', 'x'] })).toBe('x');
  });
});

// 3.12.0：发布按钮默认勾选：当前模式排第一，再补 frontmatter 里其它经扩展的平台；公众号不进扩展
import { resolvePreferredBridgePlatformIds } from '../services/platform-property.js';

describe('resolvePreferredBridgePlatformIds', () => {
  it('当前模式在前，frontmatter 目标去重补后；公众号忽略', () => {
    expect(resolvePreferredBridgePlatformIds('rednote', ['wechat', 'x', 'rednote'])).toEqual(['xiaohongshu', 'x']);
    expect(resolvePreferredBridgePlatformIds('x', ['rednote'])).toEqual(['x', 'xiaohongshu']);
    expect(resolvePreferredBridgePlatformIds('x', [])).toEqual(['x']);
    expect(resolvePreferredBridgePlatformIds('wechat', ['wechat'])).toEqual([]);
  });
});
