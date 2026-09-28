// views/frontmatter/publish-meta.js
//
// frontmatter 发布元数据与清理：读取当前文档 frontmatter 的 excerpt / cover / cover_dir / title、
// 同步后清理 frontmatter 里失效的 cover / cover_dir 路径、vault 路径解析、清理目录模板解析与
// 安全校验，从 AppleStyleView god-class 抽出为 prototype mixin（Object.assign 到 view 原型），
// 方法内 `this` 用法保持不变。

// 共享类型定义来自 input.js（仅供 JSDoc 类型检查，无运行时依赖）
/** @typedef {import('../../input.js').TFileLike} TFileLike */
/** @typedef {import('../../input.js').CleanupResultLike} CleanupResultLike */

import { normalizeVaultPath } from '../../services/path-utils.js';
import { toReadableError, toRecord, toText } from '../../services/input-utils.js';

/** @typedef {import('../../input.js').AppleStyleViewInstance} AppleStyleViewInstance */
/** @satisfies {ThisType<AppleStyleViewInstance>} */
export const publishMetaMixin = {
  /**
   * 获取当前发布上下文文件：
   * 1) 优先当前活动文件
   * 2) 回退到最近一次活动文件（侧边栏切换 tab 后常见）
   * @returns {TFileLike | null}
   */
  getPublishContextFile() {
    const activeFile = this.app?.workspace?.getActiveFile?.();
    if (activeFile) return activeFile;
    if (this.lastActiveFile) return this.lastActiveFile;
    return null;
  },

  /**
   * 读取当前文档 frontmatter 中的发布元数据
   * @returns {{ excerpt: string, cover: string, cover_dir: string, coverSrc: string|null, title: string }}
   */
  /**
   * @param {TFileLike | unknown | null | undefined} activeFile
   * @returns {{ excerpt: string, cover: string, cover_dir: string, coverSrc: string|null, title: string }}
   */
  getFrontmatterPublishMeta(activeFile) {
    if (!activeFile) {
      return { excerpt: '', cover: '', cover_dir: '', coverSrc: null, title: '' };
    }

    const frontmatter = this.app?.metadataCache?.getFileCache?.(activeFile)?.frontmatter;
    const excerpt = this.getFrontmatterString(frontmatter, ['excerpt']);
    const cover = this.getFrontmatterString(frontmatter, ['cover']);
    const cover_dir = this.getFrontmatterString(frontmatter, ['cover_dir', 'coverDir', 'cover-dir', 'coverdir', 'CoverDIR']);
    const title = this.getFrontmatterString(frontmatter, ['title']);

    // 解析失败时静默回退：返回 null，不中断流程
    const coverSrc = cover ? this.resolveVaultPathToResourceSrc(cover) : null;

    return { excerpt, cover, cover_dir, coverSrc, title };
  },

  /**
   * @param {Record<string, unknown> | null | undefined} frontmatter
   * @param {string[]} keys
   * @returns {string}
   */
  getFrontmatterString(frontmatter, keys) {
    const frontmatterRecord = toRecord(frontmatter);
    if (!frontmatterRecord) return '';
    if (!Array.isArray(keys) || keys.length === 0) return '';

    const normalizedTargets = new Set(keys.map(key => this.normalizeFrontmatterKey(key)));
    for (const key of keys) {
      const value = frontmatterRecord[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }

    for (const [key, value] of Object.entries(frontmatterRecord)) {
      if (!normalizedTargets.has(this.normalizeFrontmatterKey(key))) continue;
      if (typeof value === 'string' && value.trim()) return value.trim();
    }

    return '';
  },

  /**
   * @param {unknown} key
   * @returns {string}
   */
  normalizeFrontmatterKey(key) {
    return toText(key).toLowerCase().replace(/[_-]/g, '');
  },

  /**
   * @param {Record<string, unknown> | null | undefined} frontmatter
   * @param {string[]} keys
   * @returns {Record<string, string>}
   */
  getFrontmatterKeyMap(frontmatter, keys) {
    /** @type {Record<string, string>} */
    const result = {};
    const frontmatterRecord = toRecord(frontmatter);
    if (!frontmatterRecord) return result;
    if (!Array.isArray(keys) || keys.length === 0) return result;

    const normalizedTargets = new Set(keys.map(key => this.normalizeFrontmatterKey(key)));
    for (const [key, value] of Object.entries(frontmatterRecord)) {
      if (!normalizedTargets.has(this.normalizeFrontmatterKey(key))) continue;
      if (typeof value !== 'string') continue;
      const normalizedValue = this.normalizeVaultPath(value);
      if (!normalizedValue) continue;
      result[key] = normalizedValue;
    }
    return result;
  },

  /**
   * @returns {boolean}
   */
  isPathInsideDirectory(filePath, dirPath) {
    const file = this.normalizeVaultPath(filePath);
    const dir = this.normalizeVaultPath(dirPath);
    if (!file || !dir) return false;
    if (file === dir) return true;
    return file.startsWith(`${dir}/`);
  },

  /**
   * @returns {boolean}
   */
  isPathInsideDirectoryByTail(filePath, dirPath) {
    const file = this.normalizeVaultPath(filePath);
    const dir = this.normalizeVaultPath(dirPath);
    if (!file || !dir) return false;

    const dirSegments = dir.split('/').filter(Boolean);
    if (dirSegments.length < 2) return false;

    // 允许清理目录与 frontmatter 路径存在“根前缀差异”
    // 例如 cleanedDir: Wechat/published/img
    //      cover:     published/img/post-cover.jpg
    for (let i = 1; i <= dirSegments.length - 2; i++) {
      const tailDir = dirSegments.slice(i).join('/');
      if (this.isPathInsideDirectory(file, tailDir)) {
        return true;
      }
    }
    return false;
  },

  /**
   * @returns {boolean}
   */
  shouldClearFrontmatterPathAfterCleanup(pathValue, cleanedDir) {
    const normalized = this.normalizeVaultPath(pathValue);
    if (!normalized) return false;
    if (this.isPathInsideDirectory(normalized, cleanedDir)) return true;
    return this.isPathInsideDirectoryByTail(normalized, cleanedDir);
  },

  /**
   * @param {Record<string, unknown> | null | undefined} frontmatter
   * @param {string} cleanedDir
   * @returns {boolean}
   */
  clearInvalidPublishMetaInFrontmatter(frontmatter, cleanedDir) {
    const frontmatterRecord = toRecord(frontmatter);
    if (!frontmatterRecord) return false;

    let changed = false;
    const coverMap = this.getFrontmatterKeyMap(frontmatter, ['cover']);
    const coverDirMap = this.getFrontmatterKeyMap(frontmatter, ['cover_dir', 'coverDir', 'cover-dir', 'coverdir', 'CoverDIR']);

    for (const [key, value] of Object.entries(coverMap)) {
      if (this.shouldClearFrontmatterPathAfterCleanup(value, cleanedDir)) {
        frontmatterRecord[key] = '';
        changed = true;
      }
    }

    for (const [key, value] of Object.entries(coverDirMap)) {
      if (this.shouldClearFrontmatterPathAfterCleanup(value, cleanedDir)) {
        frontmatterRecord[key] = '';
        changed = true;
      }
    }

    return changed;
  },

  /**
   * @returns {Promise<boolean>}
   */
  async clearInvalidPublishMetaByTextFallback(activeFile, cleanedDir) {
    const vault = this.app?.vault;
    if (!vault || typeof vault.read !== 'function' || typeof vault.modify !== 'function') {
      return false;
    }

    const source = await vault.read(activeFile);
    if (typeof source !== 'string' || !source.startsWith('---')) return false;

    const match = source.match(/^(---[ \t]*\r?\n)([\s\S]*?)(\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$))/);
    if (!match) return false;

    let changed = false;
    const body = match[2].replace(/^([ \t]*)(cover|cover_dir|coverDir|cover-dir|coverdir|CoverDIR)([ \t]*:[ \t]*)(.*)$/gmi, (line, indent, key, separator, rawValue) => {
      const value = String(rawValue || '').trim().replace(/^['"]|['"]$/g, '');
      if (!this.shouldClearFrontmatterPathAfterCleanup(value, cleanedDir)) {
        return line;
      }
      changed = true;
      return `${indent}${key}${separator}''`;
    });

    if (!changed) return false;
    await vault.modify(activeFile, `${match[1]}${body}${match[3]}${source.slice(match[0].length)}`);
    return true;
  },

  /**
   * @returns {Promise<string | null>}
   */
  async clearInvalidPublishMetaAfterCleanup(activeFile, cleanedDirPath) {
    if (!activeFile || !cleanedDirPath) return null;

    const cleanedDir = this.normalizeVaultPath(cleanedDirPath);
    if (!cleanedDir) return null;

    try {
      const processFrontMatter = this.app?.fileManager?.['processFrontMatter'];
      if (typeof processFrontMatter === 'function') {
        await processFrontMatter.call(this.app.fileManager, activeFile, (frontmatter) => {
          this.clearInvalidPublishMetaInFrontmatter(toRecord(frontmatter), cleanedDir);
        });
      } else {
        await this.clearInvalidPublishMetaByTextFallback(activeFile, cleanedDir);
      }
    } catch (error) {
      return `资源已删除，但清理 frontmatter 中失效的 cover/cover_dir 失败: ${toReadableError(error).message}`;
    }

    return null;
  },

  /**
   * 将 vault 相对路径解析为可预览/上传的资源 src（通常是 app://）
   * @returns {string | null}
   */
  resolveVaultPathToResourceSrc(vaultPath) {
    if (typeof vaultPath !== 'string') return null;
    const normalized = vaultPath.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized) return null;

    try {
      const file = this.app.vault.getAbstractFileByPath(normalized);
      if (!file) return null;
      if (typeof file.extension !== 'string') return null; // 仅接受文件，不接受目录
      return this.app.vault.getResourcePath(file);
    } catch {
      // frontmatter 路径失效或不是文件时，静默回退
      return null;
    }
  },

  /**
   * @returns {string}
   */
  normalizeVaultPath(vaultPath) {
    return normalizeVaultPath(vaultPath);
  },

  /**
   * @returns {string}
   */
  getVaultConfigDir() {
    const configDir = this.app?.vault?.configDir;
    return typeof configDir === 'string' ? this.normalizeVaultPath(configDir) : '';
  },

  /**
   * @returns {string}
   */
  getCleanupDirTemplate() {
    const raw = typeof this.plugin?.settings?.cleanupDirTemplate === 'string'
      ? this.plugin.settings.cleanupDirTemplate
      : '';
    return this.normalizeVaultPath(raw);
  },

  /**
   * @param {TFileLike | null | undefined} activeFile
   * @returns {{ path: string, warning?: string }}
   */
  resolveCleanupDirPath(activeFile) {
    const template = this.getCleanupDirTemplate();
    if (!template) {
      return { path: '', warning: '未配置清理目录，请在插件设置中先填写目录后再启用自动清理' };
    }

    const hasNotePlaceholder = /\{\{\s*note\s*\}\}/i.test(template);
    if (hasNotePlaceholder && !activeFile) {
      return { path: '', warning: '当前没有活动文档，无法解析清理目录中的 {{note}}' };
    }

    const noteName = typeof activeFile?.basename === 'string' ? activeFile.basename.trim() : '';
    const resolved = template.replace(/\{\{\s*note\s*\}\}/gi, noteName);
    const normalized = this.normalizeVaultPath(resolved);
    if (!normalized) {
      return { path: '', warning: '清理目录为空，请检查设置值' };
    }

    return { path: normalized };
  },

  /**
   * 清理目录安全校验：禁止空路径、上跳路径、系统配置目录等危险路径
   * @returns {boolean}
   */
  isSafeCleanupDirPath(vaultPath) {
    const normalized = this.normalizeVaultPath(vaultPath);
    if (!normalized) return false;
    if (normalized === '.') return false;
    if (normalized.includes('..')) return false;
    const configDir = this.getVaultConfigDir();
    if (configDir && (normalized === configDir || normalized.startsWith(`${configDir}/`))) return false;
    return true;
  },

  /**
   * 在同步成功后按配置清理目录
   * 失败返回 warning，不抛错（避免影响同步成功状态）
   * @param {TFileLike | null | undefined} activeFile
   * @returns {Promise<CleanupResultLike>}
   */
  cleanupConfiguredDirectory(_activeFile) {
    // 「发送成功后自动清理资源」功能已移除：无条件跳过，老配置(data.json 里的
    // cleanupAfterSync) 也不再触发，避免删了设置项后无法关闭。
    return Promise.resolve({ attempted: false });
  },
};
