// services/bridge-sync-tasks.js
//
// 扩展结果回推（3.12.0，配合 Crosspost 3.1.0）：投递时按 syncId 记住「哪篇笔记、哪些平台」，
// 收到 sync_event 后把结果落到该笔记的 frontmatter（成功 → platform_<name>: 1 并移出待确认；失败 → publish_failed）。
// 只放内存：Obsidian 重启后收到的结果找不到笔记，只能提示（getSyncTask 兜不回笔记路径，这是有意的取舍）。
// 纯逻辑，不碰 Obsidian API，便于单测。

import { PUBLISH_KIND_PENDING, normalizePlatformName } from './publish-status.js';

/** @typedef {{ path: string, title: string, platforms: string[], createdAt: number }} BridgeTaskLike */
/** @typedef {{ event?: string, syncId?: string, platform?: string, platformName?: string, ok?: boolean, url?: string, error?: string }} SyncEventLike */
/**
 * @typedef {{
 *   kind: 'ignored' | 'unknown_task' | 'platform_result' | 'done',
 *   syncId: string,
 *   task: BridgeTaskLike | null,
 *   platform: string,
 *   ok: boolean,
 *   url: string,
 *   error: string,
 *   notice: string,
 *   statusPayload: { targets?: Array<{ platform: string, kind: string, url?: string }>, failedTargets?: Array<{ platform: string }>, requestedCount?: number } | null,
 * }} SyncEventDecision
 */

const MAX_TASKS = 200;

export class BridgeSyncTaskRegistry {
  constructor() {
    /** @type {Map<string, BridgeTaskLike>} */
    this.tasks = new Map();
  }

  /**
   * @param {unknown} syncId
   * @param {{ path: string, title?: string, platforms: string[] }} task
   * @returns {boolean} 是否记录（syncId 或 path 为空则不记）
   */
  register(syncId, task) {
    const id = typeof syncId === 'string' ? syncId.trim() : '';
    const path = task && typeof task.path === 'string' ? task.path.trim() : '';
    if (!id || !path) return false;
    this.tasks.set(id, {
      path,
      title: task.title || '',
      platforms: Array.isArray(task.platforms) ? task.platforms.map((p) => normalizePlatformName(p)).filter(Boolean) : [],
      createdAt: Date.now(),
    });
    if (this.tasks.size > MAX_TASKS) {
      for (const oldest of this.tasks.keys()) {
        this.tasks.delete(oldest);
        break;
      }
    }
    return true;
  }

  /**
   * @param {string} syncId
   * @returns {BridgeTaskLike | null}
   */
  get(syncId) {
    return this.tasks.get(syncId) || null;
  }

  /**
   * 收到一条 sync_event 后决定要做什么：写哪篇笔记、写什么、给用户看什么。
   * @param {SyncEventLike} event
   * @returns {SyncEventDecision}
   */
  decide(event) {
    const syncId = typeof event?.syncId === 'string' ? event.syncId : '';
    const kind = typeof event?.event === 'string' ? event.event : '';
    const platform = normalizePlatformName(event?.platform);
    const platformLabel = typeof event?.platformName === 'string' && event.platformName ? event.platformName : platform;
    const ok = event?.ok === true;
    const url = typeof event?.url === 'string' ? event.url : '';
    const error = typeof event?.error === 'string' ? event.error : '';
    const base = { syncId, platform, ok, url, error, statusPayload: null, notice: '' };
    const task = syncId ? this.get(syncId) : null;

    if (kind !== 'platform_result' && kind !== 'done') {
      return { ...base, kind: 'ignored', task };
    }
    if (kind === 'done') {
      if (task) this.tasks.delete(syncId);
      return { ...base, kind: 'done', task };
    }
    if (!platform) {
      return { ...base, kind: 'ignored', task };
    }
    if (!task) {
      return {
        ...base,
        kind: 'unknown_task',
        task: null,
        notice: ok
          ? `浏览器扩展已把草稿写入 ${platformLabel}，但本次会话没有对应笔记记录（Obsidian 重启过？），请手动核对 frontmatter。`
          : `浏览器扩展写入 ${platformLabel} 失败：${error || '未知原因'}（本次会话没有对应笔记记录）`,
      };
    }
    const noteTitle = task.title || task.path;
    if (ok) {
      return {
        ...base,
        kind: 'platform_result',
        task,
        statusPayload: { targets: [{ platform, kind: 'draft', url }], requestedCount: 1 },
        notice: `✅ 《${noteTitle}》已写入 ${platformLabel} 草稿箱${url ? `：${url}` : ''}`,
      };
    }
    return {
      ...base,
      kind: 'platform_result',
      task,
      statusPayload: { failedTargets: [{ platform }] },
      notice: `❌ 《${noteTitle}》写入 ${platformLabel} 失败：${error || '未知原因'}`,
    };
  }
}

/** 投递时 frontmatter 记 pending 的 kind（这里 re-export，调用方少一个 import） */
export { PUBLISH_KIND_PENDING };
