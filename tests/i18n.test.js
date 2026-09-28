// tests/i18n.test.js
//
// 3.12.0 设置界面中英切换：语言映射、缺 key 报错、参数插值、两套字典 key 完全一致。
import { describe, it, expect, afterEach } from 'vitest';

if (typeof window.require !== 'function') window.require = require;

const obsidian = require('obsidian');
const { t, getLocale, resolveLocale, resetLocaleCache, LOCALE_DICTIONARIES } = require('../services/i18n.js');

const originalGetLanguage = obsidian.getLanguage;

describe('i18n', () => {
  afterEach(() => {
    obsidian.getLanguage = originalGetLanguage;
    resetLocaleCache();
  });

  it('中文（简体 / 繁体）→ 简体中文；其它语言 → 英文', () => {
    expect(resolveLocale('zh')).toBe('zh-cn');
    expect(resolveLocale('zh-TW')).toBe('zh-cn');
    expect(resolveLocale('zh-cn')).toBe('zh-cn');
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('ja')).toBe('en');
    expect(resolveLocale('')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });

  it('getLocale 读 Obsidian 的 getLanguage 并缓存；resetLocaleCache 后重读', () => {
    obsidian.getLanguage = () => 'en';
    expect(getLocale()).toBe('en');
    obsidian.getLanguage = () => 'zh';
    expect(getLocale()).toBe('en');
    resetLocaleCache();
    expect(getLocale()).toBe('zh-cn');
  });

  it('两套字典的 key 完全一致，且没有空文案', () => {
    const zh = LOCALE_DICTIONARIES['zh-cn'];
    const en = LOCALE_DICTIONARIES.en;
    const zhKeys = Object.keys(zh).sort();
    const enKeys = Object.keys(en).sort();
    expect(zhKeys.length).toBeGreaterThan(0);
    expect(enKeys).toEqual(zhKeys);
    for (const key of zhKeys) {
      expect(zh[key].trim(), `zh-cn 空文案：${key}`).not.toBe('');
      expect(en[key].trim(), `en 空文案：${key}`).not.toBe('');
      expect(key, `key 必须带命名空间：${key}`).toMatch(/^[a-zA-Z]+\.[a-zA-Z0-9]+$/);
    }
  });

  it('t() 按语言取文案并插值；缺 key 直接抛错', () => {
    const [anyKey] = Object.keys(LOCALE_DICTIONARIES['zh-cn']);
    obsidian.getLanguage = () => 'zh';
    expect(t(anyKey)).toBe(LOCALE_DICTIONARIES['zh-cn'][anyKey]);
    resetLocaleCache();
    obsidian.getLanguage = () => 'en';
    expect(t(anyKey)).toBe(LOCALE_DICTIONARIES.en[anyKey]);
    expect(() => t('nope.missing')).toThrow(/缺少界面文案/);
  });

  it('模板参数 {name} 会被替换，未提供的参数原样保留', () => {
    const { ZH_CN } = require('../services/locales/zh-cn.js');
    const withParam = Object.keys(ZH_CN).find((key) => /\{\w+\}/.test(ZH_CN[key]));
    if (!withParam) return; // 字典里暂无带参数文案时跳过
    const name = ZH_CN[withParam].match(/\{(\w+)\}/)[1];
    obsidian.getLanguage = () => 'zh';
    expect(t(withParam, { [name]: 42 })).toContain('42');
    expect(t(withParam)).toContain(`{${name}}`);
  });
});
