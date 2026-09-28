import { App, Modal } from 'obsidian';
import { t } from '../../services/i18n.js';

export class ConfirmModal extends Modal {

    private confirmed = false;

    // 参数属性展开(Node strip-only TS 兼容),行为等价
    private title: string;
    private message: string;
    private onConfirm: () => void | Promise<void>;

    constructor(
        app: App,
        title: string,
        message: string,
        onConfirm: () => void | Promise<void>
    ) {
        super(app);
        this.title = title;
        this.message = message;
        this.onConfirm = onConfirm;
    }

    onOpen() {

        const { contentEl, titleEl } = this;

        // 设置标题

        titleEl.setText(this.title);

        // 设置消息

        contentEl.createEl('p', { text: this.message });

        // 添加按钮容器

        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

        // 取消按钮

        buttonContainer.createEl('button', { text: t('rednoteSettings.cancelButton') })

            .addEventListener('click', () => this.close());

        // 确认按钮

        const confirmButton = buttonContainer.createEl('button', {

            cls: 'mod-cta',

            text: t('rednoteSettings.confirmButton')

        });

        confirmButton.addEventListener('click', () => {

            this.confirmed = true;

            this.close();

        });

    }

    onClose() {

        const { contentEl } = this;

        contentEl.empty();

        if (this.confirmed) {

            void this.onConfirm();

        }

    }

}