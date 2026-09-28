import { App, Modal, setIcon } from 'obsidian';
import { ThemeManager } from '../themeManager.ts';
import type { Theme } from '../themeManager.ts';
import { SettingsManager } from '../settings/settings.ts';
import { t } from '../../services/i18n.js';

export class ThemePreviewModal extends Modal {
    private theme: Theme;
    private themeManager: ThemeManager;
    private settingsManager: SettingsManager;

    constructor(app: App, settingsManager: SettingsManager, theme: Theme, themeManager: ThemeManager) {
        super(app);
        this.settingsManager = settingsManager;
        this.theme = theme;
        this.themeManager = themeManager;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('theme-preview-modal');

        // 添加标题
        contentEl.createEl('h2', { text: t('rednoteSettings.themePreviewTitle', { name: this.theme.name }), cls: 'red-theme-title' });

        // 添加预览区域
        const container = contentEl.createDiv('tp-red-preview-container');
        const previewContainer = container.createDiv('red-image-preview');

        const settings = this.settingsManager.getSettings();

        // 页眉区域
        const header = previewContainer.createDiv('red-preview-header');
        const userInfo = header.createDiv({ cls: 'red-user-info' });
        const userLeft = userInfo.createDiv({ cls: 'red-user-left' });
        const avatar = userLeft.createDiv({ cls: 'red-user-avatar' });
        if (settings.userAvatar) {
            avatar.createEl('img', {
                attr: {
                    src: settings.userAvatar,
                    alt: t('rednoteSettings.avatarAlt')
                }
            });
        } else {
            const placeholder = avatar.createDiv({ cls: 'red-avatar-placeholder' });
            placeholder.createSpan({
                cls: 'red-avatar-upload-icon',
                text: '📷'
            });
        }
        const userMeta = userLeft.createDiv({ cls: 'red-user-meta' });
        const userNameContainer = userMeta.createDiv({ cls: 'red-user-name-container' });
        userNameContainer.createDiv({ cls: 'red-user-name', text: `${settings.userName}` });
        setIcon(userNameContainer.createSpan({
            cls: 'red-verified-icon',
            attr: { 'aria-label': 'Verified account', role: 'img' }
        }), 'badge-check');
 
        userMeta.createDiv({ cls: 'red-user-id', text: `${settings.userId}` });
        const userRight = userInfo.createDiv({ cls: 'red-user-right' });
        userRight.createDiv({ cls: 'red-post-time', text: '2025/4/20' });
        if (settings.showHeader === false) {
            header.remove();   // 与正式渲染一致：关闭页眉时预览也不显示
        }

        // 内容区域
        const content = previewContainer.createDiv('red-preview-content');

        // 标题样式
        content.createEl('h2', { text: t('rednoteSettings.previewSampleHeading') });

        // 段落样式
        const paragraph1 = content.createEl('p');
        paragraph1.createSpan({ text: t('rednoteSettings.previewSampleParaStart') });
        paragraph1.createEl('strong', { text: t('rednoteSettings.previewSampleParaStrong') });
        paragraph1.createSpan({ text: t('rednoteSettings.previewSampleParaEnd') });

        // 列表样式
        const list = content.createEl('ul');
        list.createEl('li', { text: t('rednoteSettings.previewSampleListOne') });
        list.createEl('li', { text: t('rednoteSettings.previewSampleListTwo') });

        // 引用样式
        const quote = content.createEl('blockquote');
        quote.createEl('p', { text: t('rednoteSettings.previewSampleQuote') });

        // 代码样式
        const codeBlock = content.createEl('pre');
        codeBlock.classList.add('red-pre'); // 添加样式类
        const dots = codeBlock.createDiv('red-code-dots'); // 添加窗口按钮
        ['red', 'yellow', 'green'].forEach(color => {
            dots.createSpan({ cls: `red-code-dot red-code-dot-${color}` });
        });
        codeBlock.createEl('code', { text: t('rednoteSettings.previewSampleCode') });

        // 分隔线样式
        content.createEl('hr');

        content.createEl('strong', { text: t('rednoteSettings.previewSampleTip') });

        // 页脚区域
        const footer = previewContainer.createDiv('red-preview-footer');
        // 页脚内容
        if (footer) {
            // 检查是否显示页脚
            if (settings.showFooter !== false) {
                footer.createDiv({ cls: 'red-footer-text', text: `${settings.footerLeftText}` });
                footer.createDiv({ cls: 'red-footer-separator', text: '|' });
                footer.createDiv({ cls: 'red-footer-text', text: `${settings.footerRightText}` });
            } else {
                // 完全移除页脚元素
                footer.remove();
            }
        }

        this.themeManager.applyTheme(container, this.theme);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}