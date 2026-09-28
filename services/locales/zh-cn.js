// services/locales/zh-cn.js —— 简体中文字典（各命名空间合并；3.12.0）
import settingsTab from './zh-cn/settings-tab.js';
import feishu from './zh-cn/feishu.js';
import multiPlatform from './zh-cn/multi-platform.js';
import rednoteSettings from './zh-cn/rednote-settings.js';
import commands from './zh-cn/commands.js';
import dashboard from './zh-cn/dashboard.js';

/** @type {Readonly<Record<string, string>>} */
export const ZH_CN = Object.freeze({
  ...settingsTab,
  ...feishu,
  ...multiPlatform,
  ...rednoteSettings,
  ...commands,
  ...dashboard,
});
