// 上游 note-to-red 作者个人文案（夜半 / @Yeban / 页脚）是另一位真实用户的身份：
// 老 data.json 里残留这些值时，loadSettings 必须一次性替换为通用占位文案并落盘；
// 用户自己改过的文案不能被动。
import { describe, it, expect, vi } from 'vitest';

const { SettingsManager, DEFAULT_SETTINGS, LEGACY_UPSTREAM_TEXTS } = await import('../rednote/settings/settings.ts');

async function loadWith(rednote) {
  const host = { settings: { rednote }, saveSettings: vi.fn(async () => {}) };
  const sm = new SettingsManager(host);
  await sm.loadSettings();
  return { sm, host };
}

describe('rednote 上游默认文案迁移', () => {
  it('残留的上游作者文案 → 通用占位文案，并写回宿主 data.json', async () => {
    const { sm, host } = await loadWith({ ...LEGACY_UPSTREAM_TEXTS });
    const s = sm.getSettings();
    for (const key of Object.keys(LEGACY_UPSTREAM_TEXTS)) {
      expect(s[key]).toBe(DEFAULT_SETTINGS[key]);
      expect(s[key]).not.toBe(LEGACY_UPSTREAM_TEXTS[key]);
    }
    expect(host.saveSettings).toHaveBeenCalledTimes(1);
    expect(host.settings.rednote.userName).toBe(DEFAULT_SETTINGS.userName);
  });

  it('用户自定义文案原样保留，不触发写盘', async () => {
    const custom = { userName: '张三', userId: '@zhangsan', footerLeftText: '左', footerRightText: '右' };
    const { sm, host } = await loadWith({ ...custom });
    const s = sm.getSettings();
    for (const [k, v] of Object.entries(custom)) expect(s[k]).toBe(v);
    expect(host.saveSettings).not.toHaveBeenCalled();
  });

  it('只替换仍等于上游值的字段，其余字段不动', async () => {
    const { sm } = await loadWith({
      userName: '我的名字',
      footerRightText: LEGACY_UPSTREAM_TEXTS.footerRightText,
    });
    const s = sm.getSettings();
    expect(s.userName).toBe('我的名字');
    expect(s.footerRightText).toBe(DEFAULT_SETTINGS.footerRightText);
  });

  it('新默认值不再包含上游作者身份', async () => {
    const joined = [DEFAULT_SETTINGS.userName, DEFAULT_SETTINGS.userId, DEFAULT_SETTINGS.footerLeftText, DEFAULT_SETTINGS.footerRightText].join('|');
    expect(joined).not.toMatch(/夜半|Yeban/);
  });
});
