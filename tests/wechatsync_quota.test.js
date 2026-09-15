// 小红书 / X 发布额度：设置字段、文案格式化、爱发电订单号兑换
import { describe, it, expect, vi } from 'vitest';

const { normalizeMultiPlatformSyncSettings, createDefaultMultiPlatformSyncSettings } = require('../services/wechatsync-settings');
const { formatQuotaSummary, formatQuotaResetTime, formatLicenseStateHint, formatLicenseExpiry, formatCurrentPlanLine, formatTierTable, fetchQuotaPlans, redeemLicenseKey } = await import('../services/wechatsync-quota.js');
const { LICENSE_API_BASE } = await import('../services/wechatsync-constants.js');

describe('licenseKey 设置字段', () => {
  it('默认为空串；归一化去空白；非字符串回空', () => {
    expect(createDefaultMultiPlatformSyncSettings().licenseKey).toBe('');
    expect(normalizeMultiPlatformSyncSettings({ licenseKey: '  NCS-AAAAA-BBBBB-CCCCC-DDDDD ' }).licenseKey).toBe('NCS-AAAAA-BBBBB-CCCCC-DDDDD');
    expect(normalizeMultiPlatformSyncSettings({ licenseKey: 123 }).licenseKey).toBe('');
  });
});

describe('额度文案', () => {
  it('formatQuotaSummary 区分有限 / 不限', () => {
    expect(formatQuotaSummary({ tier: 'free', limit: 3, used: 1, remaining: 2 })).toBe('Free 档 · 今日剩余 2/3 次');
    expect(formatQuotaSummary({ tier: 'max', limit: null, used: 9, remaining: null })).toBe('Max 档 · 今日不限次');
  });
  it('重置时间按上海时区；无法解析返回空串', () => {
    expect(formatQuotaResetTime('2026-09-15T16:00:00.000Z')).toBe('9/16 00:00');
    expect(formatQuotaResetTime('nope')).toBe('');
  });
  it('密钥状态附注', () => {
    expect(formatLicenseStateHint({ license_state: 'expired' })).toContain('已过期');
    expect(formatLicenseStateHint({ license_state: 'valid' })).toBe('');
  });
});

describe('当前方案一句话与档位表', () => {
  it('formatCurrentPlanLine：Pro 带到期；Free 提示未绑定；Max 永久；过期提示', () => {
    expect(formatCurrentPlanLine({ tier: 'pro', license_state: 'valid', license_expires_at: '2026-10-15T09:11:22.243Z', limit: 30, used: 2, remaining: 28, reset_at: '2026-09-15T16:00:00.000Z' }))
      .toBe('当前方案 Pro · 今日剩余 28/30 次（9/16 00:00 重置） · 到期 2026-10-15');
    expect(formatCurrentPlanLine({ tier: 'free', license_state: 'none', license_expires_at: null, limit: 3, used: 0, remaining: 3, reset_at: '2026-09-15T16:00:00.000Z' }))
      .toBe('当前方案 Free · 今日剩余 3/3 次（9/16 00:00 重置） · 未绑定许可密钥');
    expect(formatCurrentPlanLine({ tier: 'max', license_state: 'valid', license_expires_at: null, limit: null, used: 9, remaining: null, reset_at: '2026-09-15T16:00:00.000Z' }))
      .toBe('当前方案 Max · 今日不限次 · 永久有效');
    expect(formatCurrentPlanLine({ tier: 'free', license_state: 'expired', license_expires_at: '2026-01-01T00:00:00Z', limit: 3, used: 3, remaining: 0, reset_at: '2026-09-15T16:00:00.000Z' }))
      .toContain('许可密钥已过期');
    expect(formatLicenseExpiry('2026-10-15T09:11:22.243Z')).toBe('2026-10-15');
    expect(formatLicenseExpiry(null)).toBe('');
  });
  it('fetchQuotaPlans + formatTierTable', async () => {
    const requestUrl = vi.fn(async () => ({ status: 200, json: { ok: true, tiers: { free: { daily_limit: 3 }, pro: { daily_limit: 30 }, max: { daily_limit: null } }, upgrade_url: 'u' } }));
    const plans = await fetchQuotaPlans(requestUrl);
    expect(formatTierTable(plans.tiers)).toBe('Free 每日 3 次 ｜ Pro 每日 30 次 ｜ Max 不限次');
    await expect(fetchQuotaPlans(vi.fn(async () => ({ status: 502, json: {} })))).rejects.toThrow('HTTP 502');
  });
});

describe('redeemLicenseKey', () => {
  it('成功：POST 订单号到许可服务并返回密钥', async () => {
    const requestUrl = vi.fn(async () => ({ status: 200, json: { ok: true, license_key: 'NCS-AAAAA-BBBBB-CCCCC-DDDDD', tier: 'pro', expires_at: '2026-10-15T02:00:00.000Z' } }));
    const r = await redeemLicenseKey(requestUrl, ' 2026091512345 ');
    expect(r.license_key).toBe('NCS-AAAAA-BBBBB-CCCCC-DDDDD');
    const call = requestUrl.mock.calls[0][0];
    expect(call.url).toBe(`${LICENSE_API_BASE}/v1/license/redeem`);
    expect(JSON.parse(call.body)).toEqual({ order_no: '2026091512345' });
  });
  it('失败：服务端错误文案原样抛出；空订单号直接拒绝', async () => {
    const requestUrl = vi.fn(async () => ({ status: 404, json: { ok: false, error: '未找到该订单' } }));
    await expect(redeemLicenseKey(requestUrl, 'x')).rejects.toThrow('未找到该订单');
    await expect(redeemLicenseKey(requestUrl, '')).rejects.toThrow('请先填写爱发电订单号');
    expect(requestUrl).toHaveBeenCalledTimes(1);
  });
});
