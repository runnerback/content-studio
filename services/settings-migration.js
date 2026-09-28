// services/settings-migration.js
//
// 插件设置加载时的规范化与数据迁移（纯函数，不依赖 Obsidian API）：
// AppleStylePlugin.loadSettings() 读到 data.json 后调用，返回迁移后的 settings 以及是否需要回写。
// 逻辑原样来自 input.js 的 loadSettings()。

// 共享类型定义来自 input.js（仅供 JSDoc 类型检查，无运行时依赖）
/** @typedef {import('../input.js').WechatAccountLike} WechatAccountLike */

import { normalizeVaultPath } from './path-utils.js';
import { normalizeMultiPlatformSyncSettings } from './wechatsync-settings.js';
import { normalizeFeishuSyncSettings } from './feishu-settings.js';
import { normalizeDraftCache } from './wechat-draft-cache.js';
import { normalizeAiSettings } from './ai-layout.js';
import { isRecord, toRecord, toText } from './input-utils.js';

/**
 * @param {Record<string, unknown>} loadedData 已读取的 data.json 内容（toRecord 之后）
 * @param {{ defaults: Record<string, unknown>, generateId: () => string }} options defaults：DEFAULT_SETTINGS；generateId：迁移旧单账号时生成账号 id
 * @returns {{ settings: Record<string, unknown>, didMigrate: boolean }}
 */
export function migrateLoadedSettings(loadedData, { defaults, generateId }) {
  const settings = Object.assign({}, defaults, loadedData);
  let didMigrate = false;

  if (!settings['clientId']) {
    settings['clientId'] = 'wp_dev_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    didMigrate = true;
  }

  settings['multiPlatformSync'] = normalizeMultiPlatformSyncSettings(settings['multiPlatformSync']);
  settings['feishuSync'] = normalizeFeishuSyncSettings(settings['feishuSync']);

  const normalizedDraftCache = normalizeDraftCache(settings['draftCache']);
  settings['draftCache'] = normalizedDraftCache.cache;
  if (normalizedDraftCache.changed) {
    didMigrate = true;
  }

  const rawAiSettings = loadedData.ai;
  settings['ai'] = normalizeAiSettings(rawAiSettings || settings['ai'] || {});
  if (rawAiSettings !== undefined) {
    const normalizedRawAi = normalizeAiSettings(toRecord(rawAiSettings));
    if (JSON.stringify(normalizedRawAi) !== JSON.stringify(rawAiSettings)) {
      didMigrate = true;
    }
  }

  // 数据迁移：将旧的单账号格式迁移到新的多账号格式（3.12.0：迁移后把旧字段整个删掉，不再留空串）
  if (settings['wechatAppId'] && settings['wechatAccounts'].length === 0) {
    const migratedAccount = {
      id: generateId(),
      name: '我的公众号',
      appId: toText(settings['wechatAppId']),
      appSecret: toText(settings['wechatAppSecret']),
    };
    /** @type {WechatAccountLike[]} */ (settings['wechatAccounts']).push(migratedAccount);
    settings['defaultAccountId'] = migratedAccount.id;
    didMigrate = true;
  }
  for (const legacyKey of ['wechatAppId', 'wechatAppSecret']) {
    if (Object.prototype.hasOwnProperty.call(settings, legacyKey)) {
      delete settings[legacyKey];
      didMigrate = true;
    }
  }

  if (Array.isArray(settings['wechatAccounts'])) {
    settings['wechatAccounts'] = /** @type {WechatAccountLike[]} */ (settings['wechatAccounts'].map((account) => {
      if (!isRecord(account)) return /** @type {WechatAccountLike} */ ({ id: '', name: '', appId: '', appSecret: '' });
      const nextAccount = { ...account };
      let changed = false;

      if (Object.prototype.hasOwnProperty.call(nextAccount, 'enableOriginal')) {
        delete nextAccount.enableOriginal;
        changed = true;
      }
      if (Object.prototype.hasOwnProperty.call(nextAccount, 'allowReprint')) {
        delete nextAccount.allowReprint;
        changed = true;
      }

      if (changed) {
        didMigrate = true;
      }
      return /** @type {WechatAccountLike} */ (nextAccount);
    }));
  }

  // 数据迁移：旧清理配置 -> cleanupDirTemplate
  const currentTemplate = normalizeVaultPath(settings['cleanupDirTemplate'] || '');
  const legacyRootDir = normalizeVaultPath(settings['cleanupRootDir'] || '');
  const legacyTarget = settings['cleanupTarget'];

  // 仅迁移旧的 folder 模式，避免把 file 模式误迁移成“删目录”
  if (!currentTemplate && legacyRootDir && legacyTarget === 'folder') {
    settings['cleanupDirTemplate'] = `${legacyRootDir}/{{note}}_img`;
    didMigrate = true;
  }

  // 清理弃用字段，避免后续歧义
  if (Object.prototype.hasOwnProperty.call(settings, 'cleanupRootDir')) {
    delete settings['cleanupRootDir'];
    didMigrate = true;
  }
  if (Object.prototype.hasOwnProperty.call(settings, 'cleanupTarget')) {
    delete settings['cleanupTarget'];
    didMigrate = true;
  }

  // native-only: 清理已弃用的 legacy/parity 渲染开关
  const deprecatedRenderKeys = [
    'useTripletPipeline',
    'tripletFallbackToPhase2',
    'enforceTripletParity',
    'tripletParityMaxLengthDelta',
    'tripletParityMaxSegmentCount',
    'tripletParityVerboseLog',
    'useNativePipeline',
    'enableLegacyFallback',
    'enforceNativeParity',
  ];
  for (const key of deprecatedRenderKeys) {
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      delete settings[key];
      didMigrate = true;
    }
  }

  return { settings, didMigrate };
}
