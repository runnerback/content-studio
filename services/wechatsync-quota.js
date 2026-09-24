// services/wechatsync-quota.js
//
// 小红书 / X 发布额度：计量在浏览器扩展 → 许可服务完成，本模块只负责
// (1) 把服务端返回的额度对象格式化成文案；(2) 用爱发电订单号兑换许可密钥。
// 额度对象结构与许可服务 GET /v1/quota/status 一致（tier / limit / used / remaining / reset_at / upgrade_url / license_state）。

import { LICENSE_API_BASE } from './wechatsync-constants.js';
import { toRecord, toText } from './input-utils.js';

/**
 * @typedef {{ url: string, method: string, contentType?: string, body?: string, throw: boolean }} LicenseRequestOptionsLike 发往许可服务的请求参数（Obsidian requestUrl 子集）
 * @typedef {(options: LicenseRequestOptionsLike) => Promise<unknown>} LicenseRequestUrlLike
 * @typedef {{ daily_limit?: number | null }} QuotaTierLike
 * @typedef {{ license_key: string, tier: string, expires_at: string | null }} LicenseRedeemResultLike
 */

/** @type {Record<string, string>} */
const TIER_LABEL = { free: 'Free', pro: 'Pro', max: 'Max' };

/**
 * @param {Record<string, unknown>} quota
 * @returns {string}
 */
export function formatQuotaSummary(quota) {
  const tierKey = toText(quota.tier);
  const tier = TIER_LABEL[tierKey] || tierKey;
  if (quota.limit === null || quota.limit === undefined) return `${tier} 档 · 今日不限次`;
  return `${tier} 档 · 今日剩余 ${toText(quota.remaining)}/${toText(quota.limit)} 次`;
}

/**
 * @param {unknown} isoText → "9/16 00:00"（上海时间）；无法解析时返回空串
 * @returns {string}
 */
export function formatQuotaResetTime(isoText) {
  const d = new Date(toText(isoText));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * 密钥状态附注：过期 / 无效 / 停用时提示已按 Free 计量
 * @param {Record<string, unknown>} quota
 * @returns {string}
 */
export function formatLicenseStateHint(quota) {
  switch (quota.license_state) {
    case 'expired': return '许可密钥已过期，已按 Free 档计量';
    case 'invalid': return '许可密钥无效，已按 Free 档计量';
    case 'disabled': return '许可密钥已停用，已按 Free 档计量';
    default: return '';
  }
}

/**
 * 许可到期日 → "2026-10-15"（上海日期）；null/无法解析 → 空串
 * @param {unknown} isoText
 * @returns {string}
 */
export function formatLicenseExpiry(isoText) {
  const d = new Date(toText(isoText));
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/**
 * 当前方案一句话：档位 + 今日用量 + 重置时间 + 到期/密钥状态
 * @param {Record<string, unknown>} quota
 * @returns {string}
 */
export function formatCurrentPlanLine(quota) {
  const parts = [`当前方案 ${formatQuotaSummary(quota).replace(' 档 · ', ' · ')}`];
  const reset = formatQuotaResetTime(quota.reset_at);
  if (reset && quota.limit !== null && quota.limit !== undefined) parts[0] += `（${reset} 重置）`;
  const hint = formatLicenseStateHint(quota);
  if (hint) parts.push(hint);
  else if (quota.license_state === 'valid') parts.push(quota.license_expires_at ? `到期 ${formatLicenseExpiry(quota.license_expires_at)}` : '永久有效');
  else parts.push('未绑定许可密钥');
  return parts.join(' · ');
}

/**
 * 读取档位表（许可服务 GET /v1/plans），限额以服务端为准。
 * @param {LicenseRequestUrlLike} requestUrl
 * @returns {Promise<{ tiers: Record<string, QuotaTierLike>, upgrade_url: string }>}
 */
export async function fetchQuotaPlans(requestUrl) {
  const res = toRecord(await requestUrl({ url: `${LICENSE_API_BASE}/v1/plans`, method: 'GET', throw: false }));
  const status = typeof res.status === 'number' ? res.status : 0;
  const json = toRecord(res.json);
  if (status !== 200 || !json.ok || !json.tiers) throw new Error(`档位表读取失败（HTTP ${status}）`);
  return {
    tiers: /** @type {Record<string, QuotaTierLike>} */ (json.tiers),
    upgrade_url: typeof json.upgrade_url === 'string' ? json.upgrade_url : '',
  };
}

/**
 * 档位表 → "Free 每日 3 次 ｜ Pro 每日 30 次 ｜ Max 不限次"
 * @param {Record<string, QuotaTierLike> | null | undefined} tiers
 * @returns {string}
 */
export function formatTierTable(tiers) {
  const table = tiers || {};
  return ['free', 'pro', 'max']
    .filter((tier) => Boolean(table[tier]))
    .map((tier) => {
      const limit = table[tier].daily_limit;
      return `${TIER_LABEL[tier]} ${limit === null || limit === undefined ? '不限次' : `每日 ${limit} 次`}`;
    })
    .join(' ｜ ');
}

/**
 * 爱发电订单号 → 许可密钥（许可服务 POST /v1/license/redeem）。
 * @param {LicenseRequestUrlLike} requestUrl Obsidian 的 requestUrl
 * @param {string} orderNo
 * @returns {Promise<LicenseRedeemResultLike>}
 */
export async function redeemLicenseKey(requestUrl, orderNo) {
  const no = String(orderNo || '').trim();
  if (!no) throw new Error('请先填写爱发电订单号');
  const res = toRecord(await requestUrl({
    url: `${LICENSE_API_BASE}/v1/license/redeem`,
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ order_no: no }),
    throw: false,
  }));
  const status = typeof res.status === 'number' ? res.status : 0;
  const json = toRecord(res.json);
  if (status !== 200 || !json.ok) {
    throw new Error(typeof json.error === 'string' && json.error ? json.error : `兑换失败（HTTP ${status}）`);
  }
  return /** @type {LicenseRedeemResultLike} */ (json);
}
