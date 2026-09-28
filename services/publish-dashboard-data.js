// services/publish-dashboard-data.js
//
// 分发看板的数据层（3.12.0）：纯函数，把每篇笔记的 frontmatter 归纳成一行——
//   目标平台（platform，可数组）/ 已确认发布（platform_<name>: 1）/ 待确认（publish_pending）/ 最近时间 / 状态。
// 视图（views/dashboard/publish-dashboard.js）只负责渲染与交互；这里不碰 Obsidian API，便于单测。
// frontmatter 的 key 与 services/publish-status.js 一致。

import { FRONTMATTER_KEYS, PUBLISH_STATUS_PENDING, PUBLISH_STATUS_PARTIAL, PUBLISH_STATUS_SYNCED, normalizePlatformName } from './publish-status.js';
import { resolvePlatformTargetsFromFrontmatter } from './platform-property.js';

/** @typedef {'wechat' | 'rednote' | 'x'} DashboardPlatform */
/** @typedef {'unpublished' | 'pending' | 'failed' | 'partial' | 'synced'} DashboardStatus */
/**
 * @typedef {{
 *   path: string,
 *   title: string,
 *   targets: DashboardPlatform[],
 *   published: string[],
 *   pending: string[],
 *   failed: string[],
 *   missing: string[],
 *   status: DashboardStatus,
 *   publishAt: string,
 *   publishTime: string,
 * }} DashboardRow
 */

export const DASHBOARD_PLATFORMS = Object.freeze(/** @type {DashboardPlatform[]} */ (['wechat', 'rednote', 'x']));
export const DASHBOARD_STATUSES = Object.freeze(/** @type {DashboardStatus[]} */ (['unpublished', 'pending', 'failed', 'partial', 'synced']));

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function toPlatformNameList(value) {
  const list = Array.isArray(value) ? value : (value === undefined || value === null ? [] : [value]);
  /** @type {string[]} */
  const out = [];
  for (const item of list) {
    const name = normalizePlatformName(item);
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * frontmatter 里是否有任何发布记录 / 分发意图（没有的笔记不进看板）。
 * @param {Record<string, unknown>} frontmatter
 * @returns {boolean}
 */
export function hasPublishFrontmatter(frontmatter) {
  if (!frontmatter || typeof frontmatter !== 'object') return false;
  if (resolvePlatformTargetsFromFrontmatter(frontmatter).length > 0) return true;
  if (Object.values(FRONTMATTER_KEYS).some((key) => frontmatter[key] !== undefined)) return true;
  return Object.keys(frontmatter).some((key) => key.startsWith('platform_'));
}

/**
 * 一篇笔记 → 看板行。
 * @param {{ path: string, basename?: string, frontmatter: Record<string, unknown> | null | undefined }} note
 * @returns {DashboardRow}
 */
export function buildPublishDashboardRow({ path, basename, frontmatter }) {
  const fm = frontmatter && typeof frontmatter === 'object' ? frontmatter : {};
  const targets = resolvePlatformTargetsFromFrontmatter(fm);
  const published = Object.keys(fm)
    .filter((key) => key.startsWith('platform_') && fm[key] === 1)
    .map((key) => normalizePlatformName(key.slice('platform_'.length)))
    .filter(Boolean);
  const pending = toPlatformNameList(fm[FRONTMATTER_KEYS.pending]).filter((name) => !published.includes(name));
  const failed = toPlatformNameList(fm[FRONTMATTER_KEYS.failed]).filter((name) => !published.includes(name) && !pending.includes(name));
  const missing = targets.filter((name) => !published.includes(name) && !pending.includes(name) && !failed.includes(name));

  /** @type {DashboardStatus} */
  let status;
  if (published.length === 0 && pending.length === 0) {
    status = failed.length > 0 ? 'failed' : 'unpublished';
  } else if (published.length === 0) {
    status = 'pending';
  } else {
    const recorded = fm[FRONTMATTER_KEYS.status];
    const wanted = targets.length > 0 ? targets : published;
    const allCovered = wanted.every((name) => published.includes(name)) && pending.length === 0;
    status = allCovered && recorded !== PUBLISH_STATUS_PARTIAL ? PUBLISH_STATUS_SYNCED : PUBLISH_STATUS_PARTIAL;
    if (recorded === PUBLISH_STATUS_PENDING && pending.length > 0) status = PUBLISH_STATUS_PARTIAL;
  }

  const rawTitle = typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : '';
  const publishAt = fm[FRONTMATTER_KEYS.at];
  const publishTime = fm[FRONTMATTER_KEYS.time];
  const fallbackName = typeof basename === 'string' && basename ? basename : String(path || '').split('/').pop() || '';
  return {
    path: String(path || ''),
    title: rawTitle || fallbackName.replace(/\.md$/i, ''),
    targets,
    published,
    pending,
    failed,
    missing,
    status,
    publishAt: typeof publishAt === 'string' ? publishAt : '',
    publishTime: typeof publishTime === 'string' ? publishTime : '',
  };
}

/**
 * 全库扫描：只收有分发意图或发布记录的笔记；按最近发布时间倒序，未发布的按路径排最后。
 * @param {Array<{ path: string, basename?: string }>} files
 * @param {(file: { path: string, basename?: string }) => Record<string, unknown> | null | undefined} getFrontmatter
 * @returns {DashboardRow[]}
 */
export function collectPublishDashboardRows(files, getFrontmatter) {
  /** @type {DashboardRow[]} */
  const rows = [];
  for (const file of Array.isArray(files) ? files : []) {
    const frontmatter = getFrontmatter(file);
    if (!frontmatter || !hasPublishFrontmatter(frontmatter)) continue;
    rows.push(buildPublishDashboardRow({ path: file.path, basename: file.basename, frontmatter }));
  }
  rows.sort((a, b) => {
    if (a.publishAt !== b.publishAt) return a.publishAt ? (b.publishAt ? b.publishAt.localeCompare(a.publishAt) : -1) : 1;
    return a.path.localeCompare(b.path);
  });
  return rows;
}

/**
 * @param {DashboardRow[]} rows
 * @param {{ platform?: string, status?: string, query?: string }} [filters]
 * @returns {DashboardRow[]}
 */
export function filterPublishDashboardRows(rows, { platform = 'all', status = 'all', query = '' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return rows.filter((row) => {
    if (platform !== 'all') {
      const involved = row.targets.includes(/** @type {DashboardPlatform} */ (platform))
        || row.published.includes(platform)
        || row.pending.includes(platform)
        || row.failed.includes(platform);
      if (!involved) return false;
    }
    if (status !== 'all' && row.status !== status) return false;
    if (q && !row.title.toLowerCase().includes(q) && !row.path.toLowerCase().includes(q)) return false;
    return true;
  });
}

/**
 * @param {DashboardRow[]} rows
 * @returns {{ total: number, byStatus: Record<DashboardStatus, number>, byPlatform: Record<DashboardPlatform, { targets: number, published: number, pending: number }> }}
 */
export function summarizePublishDashboard(rows) {
  /** @type {Record<DashboardStatus, number>} */
  const byStatus = { unpublished: 0, pending: 0, failed: 0, partial: 0, synced: 0 };
  /** @type {Record<DashboardPlatform, { targets: number, published: number, pending: number }>} */
  const byPlatform = {
    wechat: { targets: 0, published: 0, pending: 0 },
    rednote: { targets: 0, published: 0, pending: 0 },
    x: { targets: 0, published: 0, pending: 0 },
  };
  for (const row of rows) {
    byStatus[row.status] += 1;
    for (const name of DASHBOARD_PLATFORMS) {
      if (row.targets.includes(name)) byPlatform[name].targets += 1;
      if (row.published.includes(name)) byPlatform[name].published += 1;
      if (row.pending.includes(name)) byPlatform[name].pending += 1;
    }
  }
  return { total: rows.length, byStatus, byPlatform };
}
