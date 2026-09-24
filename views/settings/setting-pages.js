// views/settings/setting-pages.js
//
// 设置面板的三个命令式子页面（Obsidian 1.13+ SettingPage）：飞书 / 其他平台 / 小红书图卡。
// 顶层设置由 AppleStyleSettingTab.getSettingDefinitions() 声明式渲染；这三块
// 内容仍是命令式 UI，因此以 `page: () => new XxxSettingPage(tab)` 挂在
// type:'page' 定义上，宿主在用户点击进入时才实例化并调用 display()。
// 页面打开时把自身记到 tab.activeSettingPage，供 refreshSettingTabCompat
// 在后台状态变化（如浏览器插件连接变动）时只重绘当前子页面。

import { obsidianApi } from '../../services/obsidian-adapters.js';
import { toReadableError } from '../../services/input-utils.js';
import { MULTI_PLATFORM_TAB_LABEL } from '../../services/settings-defaults.js';
import { renderFeishuSettingsTab } from './feishu-tab.js';
import { renderMultiPlatformSettingsTab } from './multi-platform-tab.js';

const { SettingPage } = obsidianApi;

/** @typedef {import('./apple-style-setting-tab.js').AppleStyleSettingTab} SettingTabLike */
/** @typedef {ContentStudioSettingPage} ContentStudioSettingPageLike */

/**
 * 子页面公共基类：记录/清除 tab.activeSettingPage，display 时清空容器再渲染。
 */
class ContentStudioSettingPage extends SettingPage {
  /**
   * @param {SettingTabLike} tab AppleStyleSettingTab 实例
   * @param {string} title 页面标题（同时用于返回栏）
   */
  constructor(tab, title) {
    super();
    /** @type {SettingTabLike} */
    this.tab = tab;
    this.title = title;
  }

  display() {
    this.tab.activeSettingPage = this;
    this.containerEl.empty();
    this.renderContent();
  }

  hide() {
    if (this.tab.activeSettingPage === this) {
      this.tab.activeSettingPage = null;
    }
    super.hide();
  }

  /** 子类实现：把内容渲染进 this.containerEl */
  renderContent() {
    throw new Error(`${this.constructor.name} 未实现 renderContent()`);
  }
}

/** 「飞书」子页面：沿用 renderFeishuSettingsTab */
export class FeishuSettingPage extends ContentStudioSettingPage {
  /** @param {SettingTabLike} tab */
  constructor(tab) {
    super(tab, '飞书');
  }

  renderContent() {
    renderFeishuSettingsTab(this.tab, this.containerEl, { obsidianApi });
  }
}

/** 「其他平台」子页面：沿用 renderMultiPlatformSettingsTab */
export class MultiPlatformSettingPage extends ContentStudioSettingPage {
  /** @param {SettingTabLike} tab */
  constructor(tab) {
    super(tab, MULTI_PLATFORM_TAB_LABEL);
  }

  renderContent() {
    renderMultiPlatformSettingsTab(this.tab, this.containerEl, { obsidianApi });
  }
}

/**
 * 「小红书图卡」子页面：懒加载 RedSettingsPanel（用户信息 / 标题级别 / 主题与字体管理），
 * 把本页容器交给它命令式渲染。
 */
export class RednoteSettingPage extends ContentStudioSettingPage {
  /** @param {SettingTabLike} tab */
  constructor(tab) {
    super(tab, '小红书图卡');
    /** @type {Promise<void> | null} 供测试等待懒加载完成 */
    this.loadPromise = null;
  }

  renderContent() {
    const containerEl = this.containerEl;
    this.loadPromise = (async () => {
      try {
        const { RedSettingsPanel } = await import('../../rednote/index.ts');
        // 懒加载期间用户可能已离开本页：此时不再往已隐藏的容器里渲染
        if (this.tab.activeSettingPage !== this) return;
        new RedSettingsPanel(this.tab.app, this.tab.plugin, containerEl).render();
      } catch (error) {
        containerEl.createEl('p', {
          text: `小红书设置加载失败：${toReadableError(error).message}`,
          cls: 'setting-item-description',
        });
      }
    })();
  }
}
