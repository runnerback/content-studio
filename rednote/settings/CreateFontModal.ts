import { App, Modal, Setting, setIcon } from 'obsidian';
import { t } from '../../services/i18n.js';

export class CreateFontModal extends Modal {
    private font: { value: string; label: string; isPreset?: boolean };
    private onSubmit: (font: { value: string; label: string }) => void | Promise<void>;

    constructor(
        app: App,
        onSubmit: (font: { value: string; label: string }) => void | Promise<void>,
        existingFont?: { value: string; label: string; isPreset?: boolean }
    ) {
        super(app);
        this.onSubmit = onSubmit;
        this.font = existingFont ?? { value: '', label: '' };
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('red-font-modal');

        // 修改标题容器结构
        const headerContainer = contentEl.createDiv({ cls: 'rfd-header' });
        headerContainer.createEl('h3', { text: this.font.label ? t('rednoteSettings.fontModalEditTitle') : t('rednoteSettings.fontModalAddTitle') });
        
        // 帮助按钮容器
        const helpBtnContainer = headerContainer.createDiv({ cls: 'rfd-help-trigger' });
        const helpBtn = helpBtnContainer.createEl('button', { cls: 'rfd-help-btn' });
        setIcon(helpBtn, 'help-circle');

        // 提示框
        const helpTooltip = helpBtnContainer.createDiv({ cls: 'rfd-help-tooltip' });
        helpTooltip.setText(t('rednoteSettings.fontModalHelp'));

        new Setting(contentEl)
            .setName(t('rednoteSettings.fontNameName'))
            .setDesc(t('rednoteSettings.fontNameDesc'))
            .addText(text => text
                .setValue(this.font.label)
                .onChange(value => this.font.label = value));

        new Setting(contentEl)
            .setName(t('rednoteSettings.fontValueName'))
            .setDesc(t('rednoteSettings.fontValueDesc'))
            .addText(text => text
                .setValue(this.font.value)
                .onChange(value => this.font.value = value))

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(t('rednoteSettings.okButton'))
                .setCta()
                .onClick(() => {
                    if (!this.font.label || !this.font.value) {
                        return;
                    }
                    void this.onSubmit(this.font);
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText(t('rednoteSettings.cancelButton'))
                .onClick(() => this.close()));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}