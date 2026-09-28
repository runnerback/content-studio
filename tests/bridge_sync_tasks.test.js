// tests/bridge_sync_tasks.test.js
//
// 3.12.0 扩展结果回推：syncId ↔ 笔记登记、sync_event → 该写什么 / 提示什么；
// 桥接服务把扩展主动发的 sync_event 交给 onSyncEvent；publish-status 的 failedTargets 与 applyPublishStatusToFile。
import { describe, it, expect, vi } from 'vitest';

if (typeof window.require !== 'function') window.require = require;

const { BridgeSyncTaskRegistry } = require('../services/bridge-sync-tasks.js');
const { updatePublishFrontmatter, applyPublishStatusToFile, FRONTMATTER_KEYS, PUBLISH_STATUS_FAILED, PUBLISH_STATUS_PENDING, PUBLISH_STATUS_SYNCED } = require('../services/publish-status.js');
const { buildPublishDashboardRow } = require('../services/publish-dashboard-data.js');

describe('BridgeSyncTaskRegistry', () => {
  it('登记时归一平台名；空 syncId / 空路径不记', () => {
    const reg = new BridgeSyncTaskRegistry();
    expect(reg.register('s1', { path: 'a.md', title: 'A', platforms: ['xiaohongshu', 'x'] })).toBe(true);
    expect(reg.get('s1')).toMatchObject({ path: 'a.md', title: 'A', platforms: ['rednote', 'x'] });
    expect(reg.register('', { path: 'a.md', platforms: [] })).toBe(false);
    expect(reg.register('s2', { path: '', platforms: [] })).toBe(false);
  });

  it('platform_result 成功 → 写确认（draft + url）并提示；失败 → failedTargets；done 后清理', () => {
    const reg = new BridgeSyncTaskRegistry();
    reg.register('s1', { path: 'n/a.md', title: '文章', platforms: ['xiaohongshu'] });
    const ok = reg.decide({ event: 'platform_result', syncId: 's1', platform: 'xiaohongshu', platformName: '小红书', ok: true, url: 'https://creator.xiaohongshu.com/draft/1' });
    expect(ok.kind).toBe('platform_result');
    expect(ok.statusPayload).toEqual({ targets: [{ platform: 'rednote', kind: 'draft', url: 'https://creator.xiaohongshu.com/draft/1' }], requestedCount: 1 });
    expect(ok.notice).toContain('✅');
    expect(ok.notice).toContain('小红书');

    const fail = reg.decide({ event: 'platform_result', syncId: 's1', platform: 'x', ok: false, error: '未检测到 X 登录态' });
    expect(fail.statusPayload).toEqual({ failedTargets: [{ platform: 'x' }] });
    expect(fail.notice).toContain('❌');
    expect(fail.notice).toContain('未检测到 X 登录态');

    expect(reg.decide({ event: 'done', syncId: 's1' }).kind).toBe('done');
    expect(reg.get('s1')).toBeNull();
  });

  it('未登记的 syncId → unknown_task 只提示；accepted 等其它事件忽略', () => {
    const reg = new BridgeSyncTaskRegistry();
    const d = reg.decide({ event: 'platform_result', syncId: 'nope', platform: 'x', ok: true });
    expect(d.kind).toBe('unknown_task');
    expect(d.statusPayload).toBeNull();
    expect(d.notice).toContain('没有对应笔记记录');
    expect(reg.decide({ event: 'accepted', syncId: 'nope' }).kind).toBe('ignored');
    expect(reg.decide({}).kind).toBe('ignored');
  });
});

describe('publish-status：失败目标与文件写入', () => {
  it('只有失败：待确认移到 publish_failed，没有已确认平台时整体 failed', () => {
    const fm = { [FRONTMATTER_KEYS.pending]: ['rednote', 'x'], [FRONTMATTER_KEYS.status]: PUBLISH_STATUS_PENDING };
    updatePublishFrontmatter(fm, { failedTargets: [{ platform: 'xiaohongshu' }] });
    expect(fm[FRONTMATTER_KEYS.pending]).toEqual(['x']);
    expect(fm[FRONTMATTER_KEYS.failed]).toEqual(['rednote']);
    expect(fm[FRONTMATTER_KEYS.status]).toBe(PUBLISH_STATUS_PENDING);
    updatePublishFrontmatter(fm, { failedTargets: [{ platform: 'x' }] });
    expect(fm[FRONTMATTER_KEYS.pending]).toBeUndefined();
    expect(fm[FRONTMATTER_KEYS.failed]).toEqual(['rednote', 'x']);
    expect(fm[FRONTMATTER_KEYS.status]).toBe(PUBLISH_STATUS_FAILED);
  });

  it('失败后再次确认成功：移出 publish_failed 并点亮平台', () => {
    const fm = { [FRONTMATTER_KEYS.failed]: ['rednote'], [FRONTMATTER_KEYS.status]: PUBLISH_STATUS_FAILED };
    updatePublishFrontmatter(fm, { targets: [{ platform: 'rednote', kind: 'draft' }], requestedCount: 1, date: new Date() });
    expect(fm[FRONTMATTER_KEYS.failed]).toBeUndefined();
    expect(fm.platform_rednote).toBe(1);
    expect(fm[FRONTMATTER_KEYS.status]).toBe(PUBLISH_STATUS_SYNCED);
  });

  it('applyPublishStatusToFile 经 fileManager.processFrontMatter 写入；空 payload 不调用', async () => {
    const fm = {};
    const fileManager = { processFrontMatter: vi.fn(async (_file, fn) => { fn(fm); }) };
    await applyPublishStatusToFile(fileManager, { path: 'a.md' }, { targets: [] });
    expect(fileManager.processFrontMatter).not.toHaveBeenCalled();
    await applyPublishStatusToFile(fileManager, { path: 'a.md' }, { targets: [{ platform: 'x', kind: 'draft' }], requestedCount: 1 });
    expect(fileManager.processFrontMatter).toHaveBeenCalledTimes(1);
    expect(fm.platform_x).toBe(1);
  });

  it('看板：失败平台单独成列，状态 failed；有已确认平台时按 partial / synced', () => {
    const row = buildPublishDashboardRow({ path: 'a.md', frontmatter: { platform: ['rednote', 'x'], publish_failed: ['x'], publish_status: 'failed' } });
    expect(row.failed).toEqual(['x']);
    expect(row.missing).toEqual(['rednote']);
    expect(row.status).toBe('failed');
    const mixed = buildPublishDashboardRow({ path: 'b.md', frontmatter: { platform: ['rednote', 'x'], platform_rednote: 1, publish_failed: ['x'], publish_status: 'synced' } });
    expect(mixed.status).toBe('partial');
  });
});
