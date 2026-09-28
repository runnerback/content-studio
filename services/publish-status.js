// services/publish-status.js
//
// Pure helpers for recording per-note "publish status" into the note's
// YAML frontmatter after a successful 发布与分发 action.
//
// Design (confirmed with user):
// - English frontmatter keys, flattened for readability in Obsidian's
//   properties panel (no nested object list).
// - Wording is "已同步/synced" (most flows create drafts, not public posts).
// - Only successful platforms are recorded. No filename / folder changes.
// - Timestamp is Beijing wall time (UTC+8) WITHOUT an offset suffix, and
//   carries an ISO week + weekday marker, e.g. `2026-07-03W27-5T13:54:59`
//   (W27 = 27th ISO week of the year, -5 = Friday; Mon=1 ... Sun=7).

export const PUBLISH_STATUS_SYNCED = 'synced';
export const PUBLISH_STATUS_PARTIAL = 'partial';
// 3.12.0：经浏览器扩展投递的小红书 / X 只拿到"已接收"，真正的写入结果不会回到 Obsidian。
// 这类目标 kind 记 pending：进 publish_pending 列表、不点亮 platform_<name>，整体状态为 pending。
export const PUBLISH_STATUS_PENDING = 'pending';
export const PUBLISH_KIND_PENDING = 'pending';
// 3.12.0：扩展回推「该平台写入失败」→ 从 publish_pending 移到 publish_failed；没有任何确认时整体状态 failed
export const PUBLISH_STATUS_FAILED = 'failed';

export const FRONTMATTER_KEYS = Object.freeze({
  status: 'publish_status',
  platforms: 'publish_platforms',
  pending: 'publish_pending',
  failed: 'publish_failed',
  kind: 'publish_kind',
  time: 'publish_time',
  at: 'publish_at',
});

// Keys from earlier versions that we now flatten away.
// publish_platform(单值"最近一次平台")已废弃:多平台时只剩最后一个,信息丢失;
// 改为每平台独立布尔字段 platform_<name>: 1(见 updatePublishFrontmatter)。
const DEPRECATED_KEYS = ['publish_targets', 'last_publish_at', 'publish_platform'];

// 平台名归一(frontmatter 口径):扩展/各链路上报的别名统一成简短稳定名。
/** @type {Readonly<Record<string, string>>} */
const PLATFORM_NAME_ALIASES = Object.freeze({
  xiaohongshu: 'rednote',
  xhs: 'rednote',
  '小红书': 'rednote',
});

/**
 * 归一化平台名:别名映射(如 xiaohongshu → rednote),其余转小写。
 * @param {unknown} value
 * @returns {string}
 */
export function normalizePlatformName(value) {
  const key = (typeof value === 'string' ? value.trim() : '').toLowerCase();
  return PLATFORM_NAME_ALIASES[key] || key;
}

/**
 * @typedef {{ platform: string, kind?: string, account?: string, url?: string, time?: string }} PublishTargetInput
 * @typedef {{ platform: string, kind: string, time: string }} PublishTargetEntry
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {number} n
 * @returns {string}
 */
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * ISO-8601 week number for a Y/M/D (treated in UTC).
 * @param {number} year
 * @param {number} monthIndex 0-based
 * @param {number} day
 * @returns {number}
 */
function isoWeekNumber(year, monthIndex, day) {
  const date = new Date(Date.UTC(year, monthIndex, day));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 ... Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // move to the Thursday of this week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

/**
 * Format a Date as Beijing (UTC+8) wall time with ISO week + weekday marker,
 * e.g. `2026-07-03W27-5T13:54:59`. No timezone offset suffix. Computed from
 * UTC math so it is correct regardless of the host machine's local timezone.
 * @param {Date} [date]
 * @returns {string}
 */
export function formatBeijingTimestamp(date = new Date()) {
  const base = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const shifted = new Date(base.getTime() + 8 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const monthIndex = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  const week = isoWeekNumber(year, monthIndex, day);
  const weekday = shifted.getUTCDay() === 0 ? 7 : shifted.getUTCDay(); // Mon=1 ... Sun=7
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}W${week}-${weekday}`
    + `T${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}`;
}

/**
 * @returns {string} current time as Beijing (UTC+8) timestamp
 */
export function nowBeijingTimestamp() {
  return formatBeijingTimestamp(new Date());
}

/**
 * Standard, sortable ISO-8601 timestamp in Beijing time WITH explicit
 * `+08:00` offset, e.g. `2026-07-03T13:54:59+08:00`. Intended for the
 * machine-oriented `publish_at` field used by Dataview/Bases sort & filter.
 * @param {Date} [date]
 * @returns {string}
 */
export function formatBeijingIso(date = new Date()) {
  const base = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const shifted = new Date(base.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`
    + `T${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}+08:00`;
}

/**
 * Normalize a raw target descriptor.
 * @param {PublishTargetInput} input
 * @param {string} [now] timestamp fallback for `time`
 * @returns {PublishTargetEntry | null}
 */
export function buildPublishTarget(input, now) {
  const platform = normalizePlatformName(input && input.platform);
  if (!platform) return null;
  const kind = toTrimmedString(input && input.kind) || 'draft';
  const time = toTrimmedString(input && input.time) || toTrimmedString(now) || nowBeijingTimestamp();
  return { platform, kind, time };
}

/**
 * @param {number} requestedCount
 * @param {number} successCount
 * @returns {'synced' | 'partial'}
 */
export function resolvePublishStatus(requestedCount, successCount) {
  const requested = Number.isFinite(requestedCount) ? Number(requestedCount) : 0;
  const succeeded = Number.isFinite(successCount) ? Number(successCount) : 0;
  return requested > 0 && succeeded >= requested ? PUBLISH_STATUS_SYNCED : PUBLISH_STATUS_PARTIAL;
}

/**
 * Cumulative, de-duplicated (case-insensitive) union of platform strings.
 * @param {unknown} existing
 * @param {string[]} incoming
 * @returns {string[]}
 */
export function mergePlatformList(existing, incoming) {
  /** @type {string[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();
  const push = (/** @type {unknown} */ value) => {
    // 归一化后再去重:旧笔记里的 xiaohongshu 与新的 rednote 合并为一项
    const key = normalizePlatformName(value);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  };
  if (Array.isArray(existing)) existing.forEach(push);
  (Array.isArray(incoming) ? incoming : []).forEach(push);
  return out;
}

/**
 * Mutate a frontmatter object in place with flattened publish status.
 * Intended to be called inside `fileManager.processFrontMatter`.
 * Both timestamps are derived from the same instant (`date`):
 *   - `publish_time`: human-readable Beijing time with week/weekday
 *   - `publish_at`:   standard ISO-8601 (+08:00) for sorting/filtering
 * `failedTargets`（3.12.0）：扩展回推的失败平台，从待确认移到 publish_failed，不写时间戳。
 * @param {Record<string, unknown>} frontmatter
 * @param {{ targets?: PublishTargetInput[], failedTargets?: Array<{ platform: string }>, requestedCount?: number, date?: Date }} options
 * @returns {Record<string, unknown>}
 */
export function updatePublishFrontmatter(frontmatter, { targets, failedTargets, requestedCount, date } = { targets: [] }) {
  const fm = frontmatter && typeof frontmatter === 'object' ? frontmatter : {};
  const when = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const readableTime = formatBeijingTimestamp(when);
  const isoTime = formatBeijingIso(when);

  const normalized = (Array.isArray(targets) ? targets : [])
    .map((t) => buildPublishTarget(t, readableTime))
    .filter((t) => t !== null);
  const failedNames = mergePlatformList([], (Array.isArray(failedTargets) ? failedTargets : []).map((t) => t && t.platform));

  if (normalized.length === 0 && failedNames.length === 0) return fm; // never write an empty/false status

  if (normalized.length === 0) {
    // 只有失败：待确认 → 失败；没有任何已确认平台时整体状态记 failed
    const pendingLeft = mergePlatformList(fm[FRONTMATTER_KEYS.pending], []).filter((name) => !failedNames.includes(name));
    if (pendingLeft.length > 0) fm[FRONTMATTER_KEYS.pending] = pendingLeft;
    else if (fm[FRONTMATTER_KEYS.pending] !== undefined) delete fm[FRONTMATTER_KEYS.pending];
    fm[FRONTMATTER_KEYS.failed] = mergePlatformList(fm[FRONTMATTER_KEYS.failed], failedNames);
    const hasConfirmed = Object.keys(fm).some((key) => key.startsWith('platform_') && fm[key] === 1);
    if (!hasConfirmed && pendingLeft.length === 0) fm[FRONTMATTER_KEYS.status] = PUBLISH_STATUS_FAILED;
    return fm;
  }

  const latest = normalized[normalized.length - 1];
  const confirmed = normalized.filter((t) => t.kind !== PUBLISH_KIND_PENDING);
  const pending = normalized.filter((t) => t.kind === PUBLISH_KIND_PENDING);
  fm[FRONTMATTER_KEYS.platforms] = mergePlatformList(fm[FRONTMATTER_KEYS.platforms], normalized.map((t) => t.platform));
  // 每平台独立布尔字段:确认发布记 1;未发布的平台不写字段(0 留给手动重置);pending 不点亮
  for (const target of confirmed) {
    fm[`platform_${target.platform}`] = 1;
  }
  // 待确认列表:新投递的进列表;本次已确认的平台从列表移出
  const confirmedNames = new Set(confirmed.map((t) => t.platform));
  const nextPending = mergePlatformList(fm[FRONTMATTER_KEYS.pending], pending.map((t) => t.platform))
    .filter((name) => !confirmedNames.has(name) && !failedNames.includes(name));
  if (nextPending.length > 0) fm[FRONTMATTER_KEYS.pending] = nextPending;
  else if (fm[FRONTMATTER_KEYS.pending] !== undefined) delete fm[FRONTMATTER_KEYS.pending];
  // 失败列表：本次失败的进列表；本次确认或重新投递的平台移出
  const nextFailed = mergePlatformList(fm[FRONTMATTER_KEYS.failed], failedNames)
    .filter((name) => !confirmedNames.has(name) && !pending.some((t) => t.platform === name));
  if (nextFailed.length > 0) fm[FRONTMATTER_KEYS.failed] = nextFailed;
  else if (fm[FRONTMATTER_KEYS.failed] !== undefined) delete fm[FRONTMATTER_KEYS.failed];
  fm[FRONTMATTER_KEYS.kind] = latest.kind;
  fm[FRONTMATTER_KEYS.time] = readableTime;
  fm[FRONTMATTER_KEYS.at] = isoTime;
  fm[FRONTMATTER_KEYS.status] = confirmed.length === 0
    ? PUBLISH_STATUS_PENDING
    : resolvePublishStatus(
      typeof requestedCount === 'number' ? requestedCount : normalized.length,
      confirmed.length,
    );

  // Clean up nested/legacy keys from earlier versions for readability.
  for (const key of DEPRECATED_KEYS) {
    if (fm[key] !== undefined) delete fm[key];
  }
  return fm;
}

/**
 * 把发布状态写进笔记 frontmatter（视图「发布与分发」与扩展结果回推共用，3.12.0）。
 * @param {{ processFrontMatter: (file: unknown, fn: (frontmatter: Record<string, unknown>) => void) => Promise<void> }} fileManager Obsidian app.fileManager
 * @param {unknown} file TFile
 * @param {{ targets?: PublishTargetInput[], failedTargets?: Array<{ platform: string }>, requestedCount?: number, date?: Date }} payload
 * @returns {Promise<void>}
 */
export async function applyPublishStatusToFile(fileManager, file, payload) {
  const targets = Array.isArray(payload?.targets) ? payload.targets : [];
  const failedTargets = Array.isArray(payload?.failedTargets) ? payload.failedTargets : [];
  if (!file || (targets.length === 0 && failedTargets.length === 0)) return;
  const now = payload?.date instanceof Date ? payload.date : new Date();
  await fileManager.processFrontMatter(file, (frontmatter) => {
    updatePublishFrontmatter(frontmatter, {
      targets,
      failedTargets,
      requestedCount: typeof payload?.requestedCount === 'number' ? payload.requestedCount : targets.length,
      date: now,
    });
  });
}

