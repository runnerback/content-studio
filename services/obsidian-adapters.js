// services/obsidian-adapters.js
//
// Thin Obsidian compatibility shims extracted from input.js (Phase 2).
// These only depend on dom-utils and plain arguments (no obsidianApi
// singleton), so they are safe to import anywhere.

import { getActiveDocument, getActiveWindowValue } from './dom-utils.js';

// Resolve the Obsidian CommonJS module once (same instance as input.js via the
// require cache). Property reads stay dynamic so test mocks that reassign
// e.g. `obsidian.requestUrl` after load are still observed.
/**
 * @param {string} specifier
 * @returns {any}
 */
function loadCommonJsDependency(specifier) {
  if (typeof require === 'function') {
    return /** @type {(s: string) => unknown} */ (require)(specifier);
  }
  const activeWindowRequire = getActiveWindowValue('require');
  if (typeof activeWindowRequire === 'function') {
    return /** @type {(s: string) => unknown} */ (activeWindowRequire)(specifier);
  }
  throw new Error(`CommonJS loader unavailable for ${specifier}`);
}

/** @type {any} */
export const obsidianApi = loadCommonJsDependency('obsidian');

export function getObsidianModalClass() {
  return obsidianApi.Modal;
}

/**
 * @param {any} app
 * @returns {any}
 */
export function createObsidianModal(app) {
  const ModalClass = getObsidianModalClass();
  if (typeof ModalClass !== 'function') {
    throw new Error('当前 Obsidian 版本不支持 Modal');
  }
  return new ModalClass(app);
}

export function getObsidianSetIcon() {
  return obsidianApi.setIcon;
}

export function getObsidianRequestUrl() {
  return obsidianApi.requestUrl;
}

export function getObsidianRequest() {
  return obsidianApi.request;
}

/**
 * @returns {any}
 */
export function getAppleThemeApi() {
  return getActiveWindowValue('AppleTheme');
}

/**
 * @param {any} app
 * @returns {boolean}
 */
export function isMobileClient(app) {
  const Platform = obsidianApi && obsidianApi.Platform;
  if (Platform && typeof Platform.isMobile === 'boolean') {
    return Platform.isMobile;
  }
  return !!(app && app.isMobile);
}

export function getActiveDocumentCompat() {
  return getActiveDocument();
}

/**
 * @returns {SVGElement}
 */
export function createFallbackSvgElement() {
  const activeDocument = getActiveDocumentCompat();
  if (!activeDocument) {
    throw new Error('Active document unavailable for SVG fallback');
  }
  return activeDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

/**
 * @param {any} workspace
 * @param {any} leaf
 * @returns {Promise<void>}
 */
export function revealLeafCompat(workspace, leaf) {
  if (!workspace || !leaf) return Promise.resolve();
  const revealLeaf = workspace.revealLeaf;
  if (typeof revealLeaf === 'function') {
    return Promise.resolve(revealLeaf.call(workspace, leaf)).then(() => {});
  }
  if (typeof workspace.setActiveLeaf === 'function') {
    workspace.setActiveLeaf(leaf, { focus: true });
    return Promise.resolve();
  }
  const leafLike = /** @type {any} */ (leaf);
  if (typeof leafLike.open === 'function') {
    leafLike.open();
  }
  return Promise.resolve();
}

/**
 * @param {any} plugin
 * @returns {Record<string, unknown>}
 */
export function getPluginSettings(plugin) {
  if (!plugin || typeof plugin !== 'object') return {};
  return plugin.settings || {};
}

/**
 * @param {any} plugin
 * @param {Record<string, unknown>} settings
 * @returns {Record<string, unknown>}
 */
export function setPluginSettings(plugin, settings) {
  if (!plugin || typeof plugin !== 'object') return settings;
  plugin.settings = settings;
  return settings;
}

/**
 * 重绘插件设置面板（Obsidian 1.13+ 声明式 Settings API）。
 * 若当前正打开某个子页面（飞书 / 其他平台 / 小红书），只重绘该子页面；
 * 否则调用 tab.update() 让宿主按 getSettingDefinitions() 重新渲染顶层内容。
 * @param {any} tab AppleStyleSettingTab 实例
 * @returns {boolean} 是否触发了重绘
 */
export function refreshSettingTabCompat(tab) {
  if (!tab || typeof tab !== 'object') return false;
  const activePage = tab.activeSettingPage;
  if (activePage && typeof activePage.display === 'function') {
    activePage.display();
    return true;
  }
  if (typeof tab.update !== 'function') return false;
  tab.update();
  return true;
}
