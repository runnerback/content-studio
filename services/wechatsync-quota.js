// services/wechatsync-quota.js
//
// 小红书 / X 发布额度：计量在浏览器扩展 → 许可服务完成，本模块只负责
// (1) 把服务端返回的额度对象格式化成文案；(2) 用爱发电订单号兑换许可密钥。
// 额度对象结构与许可服务 GET /v1/quota/status 一致（tier / limit / used / remaining / reset_at / upgrade_url / license_state）。

import { LICENSE_API_BASE } from './wechatsync-constants.js';

const TIER_LABEL = { free: 'Free', pro: 'Pro', max: 'Max' };

/** @param {Record<string, unknown>} quota */
export function formatQuotaSummary(quota) {
  const tier = TIER_LABEL[String(quota.tier)] || String(quota.tier || '');
  if (quota.limit === null || quota.limit === undefined) return `${tier} 档 · 今日不限次`;
  return `${tier} 档 · 今日剩余 ${quota.remaining}/${quota.limit} 次`;
}

/** @param {unknown} isoText → "9/16 00:00"（上海时间）；无法解析时返回空串 */
export function formatQuotaResetTime(isoText) {
  const d = new Date(String(isoText || ''));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** 密钥状态附注：过期 / 无效 / 停用时提示已按 Free 计量 */
export function formatLicenseStateHint(quota) {
  switch (quota.license_state) {
    case 'expired': return '许可密钥已过期，已按 Free 档计量';
    case 'invalid': return '许可密钥无效，已按 Free 档计量';
    case 'disabled': return '许可密钥已停用，已按 Free 档计量';
    default: return '';
  }
}

/**
 * 爱发电订单号 → 许可密钥（许可服务 POST /v1/license/redeem）。
 * @param {(options: Record<string, unknown>) => Promise<{ status: number, json: any }>} requestUrl Obsidian 的 requestUrl
 * @param {string} orderNo
 * @returns {Promise<{ license_key: string, tier: string, expires_at: string | null }>}
 */
export async function redeemLicenseKey(requestUrl, orderNo) {
  const no = String(orderNo || '').trim();
  if (!no) throw new Error('请先填写爱发电订单号');
  const res = await requestUrl({
    url: `${LICENSE_API_BASE}/v1/license/redeem`,
    method: 'POST',
    contentType: 'application/json',
    body: JSON.stringify({ order_no: no }),
    throw: false,
  });
  const json = res && typeof res.json === 'object' && res.json ? res.json : {};
  if (res.status !== 200 || !json.ok) {
    throw new Error(json.error || `兑换失败（HTTP ${res.status}）`);
  }
  return json;
}
