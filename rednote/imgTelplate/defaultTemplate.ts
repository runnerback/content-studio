import type { ImgTemplate } from '../imgTemplateManager.ts';
import type { SettingsManager } from '../settings/settings.ts';
import { DEFAULT_SETTINGS } from '../settings/settings.ts';
import { Notice, setIcon } from 'obsidian';

export class DefaultTemplate implements ImgTemplate {
    id = 'default';
    name = '默认模板';
    sections = {
        header: true,
        content: true as const,
        footer: true
    };

    // 参数属性展开(Node strip-only TS 兼容),行为等价
    private settingsManager: SettingsManager;
    private onSettingsUpdate: () => Promise<void>;

    constructor(
        settingsManager: SettingsManager,
        onSettingsUpdate: () => Promise<void>
    ) {
        this.settingsManager = settingsManager;
        this.onSettingsUpdate = onSettingsUpdate;
    }

    render(element: HTMLElement) {
        const sections = element.querySelectorAll('.red-content-section');
        const settings = this.settingsManager.getSettings();
        
        sections.forEach(section => {
            // 获取已有的头部和页脚元素
            const header = element.querySelector('.red-preview-header');
            const footer = element.querySelector('.red-preview-footer');

            // 更新头部内容（与页脚同款开关：showHeader=false 时整块移除，备忘录主题的专属头部也随之不渲染）
            if (this.sections.header && header) {
                if (settings.showHeader !== false) {
                    this.createHeaderContent(header as HTMLElement);
                } else {
                    header.remove();
                }
            }

            // 页脚内容
            if (this.sections.footer && footer) {
                // 检查是否显示页脚
                if (settings.showFooter !== false) {
                    this.createFooterContent(footer as HTMLElement);
                } else {
                    // 完全移除页脚元素
                    footer.remove();
                }
            }
        });
    }

    private createHeaderContent(headerArea: HTMLElement) {
        headerArea.empty();
        const settings = this.settingsManager.getSettings();
        const userInfo = this.createUserInfoContainer(headerArea);
        
        this.createUserLeftSection(userInfo, settings);

        if (settings.showTime) {
            this.createTimeSection(userInfo, settings);
        }
    }

    private createUserInfoContainer(parent: HTMLElement): HTMLElement {
        return parent.createDiv({ cls: 'red-user-info' });
    }

    private createUserLeftSection(parent: HTMLElement, settings: any): HTMLElement {
        const userLeft = parent.createDiv({ cls: 'red-user-left' });
        this.createAvatarSection(userLeft, settings);
        this.createUserMetaSection(userLeft, settings);
        return userLeft;
    }

    private createAvatarSection(parent: HTMLElement, settings: any) {
        const avatar = parent.createDiv({
            cls: 'red-user-avatar',
            attr: { 'title': '点击上传头像' }
        });

        if (settings.userAvatar) {
            avatar.createEl('img', {
                attr: {
                    src: settings.userAvatar,
                    alt: '用户头像'
                }
            });
        } else {
            const placeholder = avatar.createDiv({ cls: 'red-avatar-placeholder' });
            placeholder.createSpan({
                cls: 'red-avatar-upload-icon',
                text: '📷'
            });
        }

        avatar.addEventListener('click', () => this.handleAvatarClick());
    }

    private createUserMetaSection(parent: HTMLElement, settings: any) {
        const userMeta = parent.createDiv({ cls: 'red-user-meta' });
        
        const userNameContainer = userMeta.createDiv({ cls: 'red-user-name-container' });
        const userName = userNameContainer.createDiv({
            cls: 'red-user-name',
            text: settings.userName,
            attr: { 'title': '点击编辑用户名' }
        });
        setIcon(userNameContainer.createSpan({
            cls: 'red-verified-icon',
            attr: { 'aria-label': 'Verified account', role: 'img' }
        }), 'badge-check');
        
        const userId = userMeta.createDiv({
            cls: 'red-user-id',
            text: settings.userId,
            attr: { 'title': '点击编辑用户ID' }
        });

        userName.addEventListener('click', () => this.handleUserNameEdit(userName));
        userId.addEventListener('click', () => this.handleUserIdEdit(userId));
    }

    private createTimeSection(parent: HTMLElement, settings: any) {
        const userRight = parent.createDiv({ cls: 'red-user-right' });
        userRight.createDiv({
            cls: 'red-post-time',
            text: new Date().toLocaleDateString(settings.timeFormat)
        });
    }

    private createFooterContent(footerArea: HTMLElement) {
        footerArea.empty();
        const settings = this.settingsManager.getSettings();

        const leftText = this.createFooterText(footerArea, settings.footerLeftText);
        
        footerArea.createDiv({
            cls: 'red-footer-separator',
            text: '|'
        });

        const rightText = this.createFooterText(footerArea, settings.footerRightText);

        leftText.addEventListener('click', () => this.handleFooterTextEdit(leftText, 'left'));
        rightText.addEventListener('click', () => this.handleFooterTextEdit(rightText, 'right'));
    }

    private createFooterText(parent: HTMLElement, text: string): HTMLElement {
        return parent.createDiv({
            cls: 'red-footer-text',
            text: text,
            attr: { 'title': '点击编辑文本' }
        });
    }

    private async handleAvatarClick() {
        const input = createEl('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (file) {
                try {
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        const base64 = e.target?.result as string;
                        await this.settingsManager.updateSettings({
                            userAvatar: base64
                        });
                        await this.onSettingsUpdate();
                    };
                    reader.readAsDataURL(file);
                } catch (error) {
                    console.error('头像更新失败:', error);
                    new Notice('头像更新失败');
                }
            }
        });

        input.click();
    }

    private async handleUserNameEdit(element: HTMLElement) {
        const input = createEl('input');
        input.value = element.textContent || '';
        input.className = 'red-user-edit-input';
        input.placeholder = '请输入用户名';
        element.replaceWith(input);
        input.focus();

        const handleBlur = async () => {
            const newName = input.value.trim();
            await this.settingsManager.updateSettings({
                userName: newName || DEFAULT_SETTINGS.userName
            });
            await this.onSettingsUpdate();
            input.replaceWith(element);
        };

        input.addEventListener('blur', handleBlur);
        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                await handleBlur();
            }
        });
    }

    private async handleUserIdEdit(element: HTMLElement) {
        const input = createEl('input');
        input.value = element.textContent || '';
        input.className = 'red-user-edit-input';
        input.placeholder = '请输入用户ID';
        element.replaceWith(input);
        input.focus();

        const handleBlur = async () => {
            const newId = input.value.trim();
            await this.settingsManager.updateSettings({
                userId: newId || DEFAULT_SETTINGS.userId
            });
            await this.onSettingsUpdate();
            input.replaceWith(element);
        };

        input.addEventListener('blur', handleBlur);
        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                await handleBlur();
            }
        });
    }

    private async handleFooterTextEdit(element: HTMLElement, position: 'left' | 'right') {
        const input = createEl('input');
        input.value = element.textContent || '';
        input.className = 'red-footer-edit-input';
        input.placeholder = '请输入页脚文本';
        element.replaceWith(input);
        input.focus();

        const handleBlur = async () => {
            const newText = input.value.trim();
            const settings = position === 'left' 
                ? { footerLeftText: newText || DEFAULT_SETTINGS.footerLeftText }
                : { footerRightText: newText || DEFAULT_SETTINGS.footerRightText };
            
            await this.settingsManager.updateSettings(settings);
            await this.onSettingsUpdate();
            input.replaceWith(element);
        };

        input.addEventListener('blur', handleBlur);
        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') {
                await handleBlur();
            }
        });
    }
}