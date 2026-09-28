// services/locales/en.js —— English dictionary (namespaces merged; 3.12.0)
import settingsTab from './en/settings-tab.js';
import feishu from './en/feishu.js';
import multiPlatform from './en/multi-platform.js';
import rednoteSettings from './en/rednote-settings.js';
import commands from './en/commands.js';
import dashboard from './en/dashboard.js';

/** @type {Readonly<Record<string, string>>} */
export const EN = Object.freeze({
  ...settingsTab,
  ...feishu,
  ...multiPlatform,
  ...rednoteSettings,
  ...commands,
  ...dashboard,
});
