// views/dashboard/publish-dashboard.js
//
// 分发看板（3.12.0）：按笔记 frontmatter 列出目标平台 / 已发布 / 待确认 / 未发布与最近时间，
// 支持按平台、状态、关键词筛选，点标题打开笔记。数据来自 services/publish-dashboard-data.js（纯函数），
// 这里只做渲染与交互；metadataCache 变化后 300ms 合并重绘。

import { obsidianApi } from '../../services/obsidian-adapters.js';
import { t } from '../../services/i18n.js';
import {
  DASHBOARD_PLATFORMS,
  DASHBOARD_STATUSES,
  collectPublishDashboardRows,
  filterPublishDashboardRows,
  summarizePublishDashboard,
} from '../../services/publish-dashboard-data.js';

/** @typedef {import('../../services/publish-dashboard-data.js').DashboardRow} DashboardRow */
/** @typedef {import('../../services/publish-dashboard-data.js').DashboardPlatform} DashboardPlatform */
/** @typedef {import('../../services/publish-dashboard-data.js').DashboardStatus} DashboardStatus */
/** @typedef {import('../../input.js').ObsidianElementLike} ObsidianElementLike */

const { ItemView } = obsidianApi;

export const PUBLISH_DASHBOARD_VIEW = 'note-content-studio-publish-dashboard';
export const PUBLISH_DASHBOARD_ICON = 'layout-list';
const RERENDER_DEBOUNCE_MS = 300;

/** @type {Record<DashboardPlatform, string>} */
const PLATFORM_LABEL_KEYS = {
  wechat: 'dashboard.platformWechat',
  rednote: 'dashboard.platformRednote',
  x: 'dashboard.platformX',
};
/** @type {Record<DashboardStatus, string>} */
const STATUS_LABEL_KEYS = {
  unpublished: 'dashboard.statusUnpublished',
  pending: 'dashboard.statusPending',
  partial: 'dashboard.statusPartial',
  synced: 'dashboard.statusSynced',
};

/**
 * @param {string} name 平台名（含旧笔记里的别名已归一）
 * @returns {string}
 */
function platformLabel(name) {
  const key = PLATFORM_LABEL_KEYS[/** @type {DashboardPlatform} */ (name)];
  return key ? t(key) : name;
}

/**
 * @typedef {{ vault: { getMarkdownFiles: () => Array<{ path: string, basename: string }> }, metadataCache: { getFileCache: (file: { path: string }) => { frontmatter?: Record<string, unknown> } | null, on: (name: string, callback: (...args: unknown[]) => void) => unknown }, workspace: { openLinkText: (linktext: string, sourcePath: string, newLeaf?: boolean) => Promise<void> } }} DashboardAppLike
 */

export class PublishDashboardView extends ItemView {
  /**
   * @param {unknown} leaf
   */
  constructor(leaf) {
    super(leaf);
    /** @type {{ platform: string, status: string, query: string }} */
    this.filters = { platform: 'all', status: 'all', query: '' };
    /** @type {DashboardRow[]} */
    this.rows = [];
    /** @type {number | null} */
    this.rerenderTimer = null;
    /** @type {ObsidianElementLike | null} */
    this.summaryEl = null;
    /** @type {ObsidianElementLike | null} */
    this.tableWrapEl = null;
  }

  getViewType() {
    return PUBLISH_DASHBOARD_VIEW;
  }

  getDisplayText() {
    return t('dashboard.viewTitle');
  }

  getIcon() {
    return PUBLISH_DASHBOARD_ICON;
  }

  /** @returns {DashboardAppLike} */
  getDashboardApp() {
    return /** @type {DashboardAppLike} */ (/** @type {unknown} */ (this.app));
  }

  onOpen() {
    const container = /** @type {ObsidianElementLike} */ (this.containerEl.children[1]);
    container.empty();
    container.addClass('ncs-dashboard');
    this.renderToolbar(container);
    this.summaryEl = container.createDiv({ cls: 'ncs-dashboard-summary' });
    this.tableWrapEl = container.createDiv({ cls: 'ncs-dashboard-table-wrap' });
    const app = this.getDashboardApp();
    this.registerEvent(app.metadataCache.on('changed', () => this.scheduleRerender()));
    this.registerEvent(app.metadataCache.on('resolved', () => this.scheduleRerender()));
    this.reload();
    return Promise.resolve();
  }

  onClose() {
    if (this.rerenderTimer !== null) {
      window.clearTimeout(this.rerenderTimer);
      this.rerenderTimer = null;
    }
    return Promise.resolve();
  }

  scheduleRerender() {
    if (this.rerenderTimer !== null) window.clearTimeout(this.rerenderTimer);
    this.rerenderTimer = window.setTimeout(() => {
      this.rerenderTimer = null;
      this.reload();
    }, RERENDER_DEBOUNCE_MS);
  }

  /** 重新扫描全库并渲染 */
  reload() {
    const app = this.getDashboardApp();
    this.rows = collectPublishDashboardRows(
      app.vault.getMarkdownFiles(),
      (file) => app.metadataCache.getFileCache(file)?.frontmatter || null,
    );
    this.renderBody();
  }

  /**
   * @param {ObsidianElementLike} container
   */
  renderToolbar(container) {
    const toolbar = container.createDiv({ cls: 'ncs-dashboard-toolbar' });
    const search = toolbar.createEl('input', {
      cls: 'ncs-dashboard-search',
      type: 'search',
      placeholder: t('dashboard.searchPlaceholder'),
    });
    search.addEventListener('input', () => {
      this.filters.query = search.value;
      this.renderBody();
    });

    const platformSelect = toolbar.createEl('select', { cls: 'dropdown ncs-dashboard-select' });
    platformSelect.createEl('option', { value: 'all', text: t('dashboard.filterPlatformAll') });
    for (const name of DASHBOARD_PLATFORMS) {
      platformSelect.createEl('option', { value: name, text: platformLabel(name) });
    }
    platformSelect.addEventListener('change', () => {
      this.filters.platform = platformSelect.value;
      this.renderBody();
    });

    const statusSelect = toolbar.createEl('select', { cls: 'dropdown ncs-dashboard-select' });
    statusSelect.createEl('option', { value: 'all', text: t('dashboard.filterStatusAll') });
    for (const status of DASHBOARD_STATUSES) {
      statusSelect.createEl('option', { value: status, text: t(STATUS_LABEL_KEYS[status]) });
    }
    statusSelect.addEventListener('change', () => {
      this.filters.status = statusSelect.value;
      this.renderBody();
    });

    const refresh = toolbar.createEl('button', { cls: 'ncs-dashboard-refresh', text: t('dashboard.refresh') });
    refresh.addEventListener('click', () => this.reload());
  }

  renderBody() {
    if (!this.summaryEl || !this.tableWrapEl) return;
    const visible = filterPublishDashboardRows(this.rows, this.filters);
    const summary = summarizePublishDashboard(this.rows);

    this.summaryEl.empty();
    this.summaryEl.createEl('span', { cls: 'ncs-dashboard-chip', text: t('dashboard.summaryTotal', { count: summary.total }) });
    for (const status of DASHBOARD_STATUSES) {
      this.summaryEl.createEl('span', {
        cls: `ncs-dashboard-chip is-${status}`,
        text: `${t(STATUS_LABEL_KEYS[status])} ${summary.byStatus[status]}`,
      });
    }

    this.tableWrapEl.empty();
    if (this.rows.length === 0) {
      this.tableWrapEl.createEl('p', { cls: 'ncs-dashboard-empty', text: t('dashboard.empty') });
      return;
    }
    if (visible.length === 0) {
      this.tableWrapEl.createEl('p', { cls: 'ncs-dashboard-empty', text: t('dashboard.emptyFiltered') });
      return;
    }

    const table = this.tableWrapEl.createEl('table', { cls: 'ncs-dashboard-table' });
    const headRow = table.createEl('thead').createEl('tr');
    for (const key of ['columnNote', 'columnTargets', 'columnPublished', 'columnPending', 'columnMissing', 'columnTime', 'columnStatus']) {
      headRow.createEl('th', { text: t(`dashboard.${key}`) });
    }
    const body = table.createEl('tbody');
    for (const row of visible) {
      const tr = body.createEl('tr', { cls: `is-${row.status}` });
      const titleCell = tr.createEl('td', { cls: 'ncs-dashboard-note' });
      const link = titleCell.createEl('a', { cls: 'ncs-dashboard-link', text: row.title, href: '#' });
      link.addEventListener('click', (event) => {
        event.preventDefault();
        void this.getDashboardApp().workspace.openLinkText(row.path, '', false);
      });
      titleCell.createEl('div', { cls: 'ncs-dashboard-path', text: row.path });
      this.renderPlatformCell(tr, row.targets);
      this.renderPlatformCell(tr, row.published);
      this.renderPlatformCell(tr, row.pending);
      this.renderPlatformCell(tr, row.missing);
      tr.createEl('td', { cls: 'ncs-dashboard-time', text: row.publishTime || row.publishAt || t('dashboard.none') });
      tr.createEl('td').createEl('span', { cls: `ncs-dashboard-status is-${row.status}`, text: t(STATUS_LABEL_KEYS[row.status]) });
    }
  }

  /**
   * @param {ObsidianElementLike} tr
   * @param {string[]} names
   */
  renderPlatformCell(tr, names) {
    const cell = tr.createEl('td', { cls: 'ncs-dashboard-platforms' });
    if (names.length === 0) {
      cell.setText(t('dashboard.none'));
      return;
    }
    for (const name of names) {
      cell.createEl('span', { cls: `ncs-dashboard-tag is-${name}`, text: platformLabel(name) });
    }
  }
}
