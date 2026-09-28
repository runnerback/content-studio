// tests/publish_dashboard_data.test.js
//
// 3.12.0 分发看板数据层：frontmatter → 行（目标 / 已发布 / 待确认 / 缺失 / 状态），扫描、筛选、汇总均为纯函数。
import { describe, it, expect } from 'vitest';
import {
  hasPublishFrontmatter,
  buildPublishDashboardRow,
  collectPublishDashboardRows,
  filterPublishDashboardRows,
  summarizePublishDashboard,
} from '../services/publish-dashboard-data.js';

describe('buildPublishDashboardRow', () => {
  it('只有 platform 意图、尚未发布 → unpublished，缺失 = 全部目标', () => {
    const row = buildPublishDashboardRow({ path: 'a/b/文章.md', basename: '文章.md', frontmatter: { platform: ['rednote', 'x'] } });
    expect(row).toMatchObject({ title: '文章', targets: ['rednote', 'x'], published: [], pending: [], missing: ['rednote', 'x'], status: 'unpublished' });
  });

  it('经扩展投递 → pending；确认后 platform_<name>: 1 → synced', () => {
    const pending = buildPublishDashboardRow({ path: 'n.md', frontmatter: {
      platform: 'rednote', publish_status: 'pending', publish_pending: ['rednote'], publish_at: '2026-09-28T12:00:00+08:00',
    } });
    expect(pending.status).toBe('pending');
    expect(pending.pending).toEqual(['rednote']);
    expect(pending.missing).toEqual([]);

    const synced = buildPublishDashboardRow({ path: 'n.md', frontmatter: {
      platform: 'rednote', publish_status: 'synced', platform_rednote: 1, publish_at: '2026-09-28T13:00:00+08:00', publish_time: '2026-09-28W40-1T13:00:00',
    } });
    expect(synced.status).toBe('synced');
    expect(synced.published).toEqual(['rednote']);
    expect(synced.publishTime).toBe('2026-09-28W40-1T13:00:00');
  });

  it('两个目标只发了一个 → partial；旧笔记 platform_xiaohongshu 归一成 rednote', () => {
    const row = buildPublishDashboardRow({ path: 'n.md', frontmatter: {
      platform: ['公众号', 'rednote'], platform_xiaohongshu: 1, publish_status: 'synced',
    } });
    expect(row.published).toEqual(['rednote']);
    expect(row.missing).toEqual(['wechat']);
    expect(row.status).toBe('partial');
  });

  it('没有 platform 意图但有发布记录：按记录判断；frontmatter 的 title 优先当标题', () => {
    const row = buildPublishDashboardRow({ path: 'x/y.md', frontmatter: { title: '自定义标题', platform_wechat: 1, publish_status: 'synced' } });
    expect(row.title).toBe('自定义标题');
    expect(row.targets).toEqual([]);
    expect(row.status).toBe('synced');
    expect(hasPublishFrontmatter({ platform_wechat: 1 })).toBe(true);
    expect(hasPublishFrontmatter({ tags: ['a'] })).toBe(false);
  });
});

describe('collect / filter / summarize', () => {
  const files = [
    { path: 'b.md', basename: 'b.md' },
    { path: 'a.md', basename: 'a.md' },
    { path: 'c.md', basename: 'c.md' },
    { path: 'd.md', basename: 'd.md' },
  ];
  const fm = {
    'a.md': { platform: 'wechat', platform_wechat: 1, publish_status: 'synced', publish_at: '2026-09-27T10:00:00+08:00' },
    'b.md': { platform: ['rednote', 'x'], publish_pending: ['rednote'], publish_status: 'pending', publish_at: '2026-09-28T09:00:00+08:00' },
    'c.md': { platform: 'x' },
    'd.md': { tags: ['无关'] },
  };
  const rows = collectPublishDashboardRows(files, (file) => fm[file.path]);

  it('只收有分发信息的笔记，按发布时间倒序、未发布垫底', () => {
    expect(rows.map((row) => row.path)).toEqual(['b.md', 'a.md', 'c.md']);
  });

  it('按平台 / 状态 / 关键词筛选', () => {
    expect(filterPublishDashboardRows(rows, { platform: 'x' }).map((r) => r.path)).toEqual(['b.md', 'c.md']);
    expect(filterPublishDashboardRows(rows, { status: 'synced' }).map((r) => r.path)).toEqual(['a.md']);
    expect(filterPublishDashboardRows(rows, { query: 'C' }).map((r) => r.path)).toEqual(['c.md']);
    expect(filterPublishDashboardRows(rows, { platform: 'rednote', status: 'pending' }).map((r) => r.path)).toEqual(['b.md']);
  });

  it('汇总按状态与平台计数', () => {
    const summary = summarizePublishDashboard(rows);
    expect(summary.total).toBe(3);
    expect(summary.byStatus).toEqual({ unpublished: 1, pending: 1, failed: 0, partial: 0, synced: 1 });
    expect(summary.byPlatform.x).toEqual({ targets: 2, published: 0, pending: 0 });
    expect(summary.byPlatform.rednote).toEqual({ targets: 1, published: 0, pending: 1 });
    expect(summary.byPlatform.wechat).toEqual({ targets: 1, published: 1, pending: 0 });
  });
});
