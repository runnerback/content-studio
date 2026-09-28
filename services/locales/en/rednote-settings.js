// services/locales/en/rednote-settings.js —— 命名空间 rednote-settings 的英文文案（3.12.0）。key 与另一语言文件一一对应，tests/i18n.test.js 校验。
// 覆盖 rednote/settings/ 下的 RedSettingsPanel / ConfirmModal / CreateFontModal / ThemePreviewModal（CreateThemeModal 未迁）。

/** @type {Readonly<Record<string, string>>} */
export default Object.freeze({
  // RedSettingsPanel：分区与子分区标题
  'rednoteSettings.sectionBasic': 'Basic settings',
  'rednoteSettings.sectionTheme': 'Theme settings',
  'rednoteSettings.typographyHeading': 'Typography',
  'rednoteSettings.fontHeading': 'Fonts',
  'rednoteSettings.visibilityHeading': 'Display',
  'rednoteSettings.hiddenThemesHeading': 'Hidden themes',
  'rednoteSettings.visibleThemesHeading': 'Visible themes',
  'rednoteSettings.customThemesHeading': 'Custom themes',
  // RedSettingsPanel：标题级别
  'rednoteSettings.headingLevelName': 'Heading level for splitting cards',
  'rednoteSettings.headingLevelDesc': 'Choose which heading level splits the content into separate cards:',
  'rednoteSettings.headingLevelH1': 'Heading 1 (#) - split by major sections',
  'rednoteSettings.headingLevelH2': 'Heading 2 (##) - split by subsections',
  'rednoteSettings.headingLevelUpdatedNotice': 'Heading level updated. Restart or reload Obsidian for the change to take effect',
  // RedSettingsPanel：显示开关
  'rednoteSettings.showTimeName': 'Show time',
  'rednoteSettings.showTimeDesc': 'Show the time in the card header',
  'rednoteSettings.showHeaderName': 'Show header',
  'rednoteSettings.showHeaderDesc': 'Show the avatar, nickname and time at the top of the card; when off, the body moves up',
  'rednoteSettings.showFooterName': 'Show footer',
  'rednoteSettings.showFooterDesc': 'Show the footer at the bottom of the card',
  // RedSettingsPanel：按钮、提示与确认弹窗
  'rednoteSettings.editTooltip': 'Edit',
  'rednoteSettings.deleteTooltip': 'Delete',
  'rednoteSettings.previewTooltip': 'Preview',
  'rednoteSettings.addFontButton': '+ Add font',
  'rednoteSettings.addThemeButton': '+ New theme',
  'rednoteSettings.reloadNotice': 'Restart or reload Obsidian for the change to take effect',
  'rednoteSettings.confirmDeleteFontTitle': 'Delete font',
  'rednoteSettings.confirmDeleteFontMessage': 'Delete the font "{name}"?',
  'rednoteSettings.confirmDeleteThemeTitle': 'Delete theme',
  'rednoteSettings.confirmDeleteThemeMessage': 'Delete the theme "{name}"? This cannot be undone.',
  // ConfirmModal / CreateFontModal 按钮
  'rednoteSettings.cancelButton': 'Cancel',
  'rednoteSettings.confirmButton': 'Confirm',
  'rednoteSettings.okButton': 'OK',
  // CreateFontModal
  'rednoteSettings.fontModalEditTitle': 'Edit font',
  'rednoteSettings.fontModalAddTitle': 'Add font',
  'rednoteSettings.fontModalHelp': `👋 How to fill in the font value
                                    • Single font: one font name is enough, e.g. "Microsoft YaHei"
                                    • Chinese fonts: add the English name too for better compatibility; it is case-insensitive, e.g. simsun
                                    • Font family: append serif/sans-serif at the end as a fallback
                                    • Separate multiple fonts with commas
                                    Examples
                                    • SimSun: simsun, "宋体", serif
                                    • Microsoft YaHei: "微软雅黑", sans-serif`,
  'rednoteSettings.fontNameName': 'Font name',
  'rednoteSettings.fontNameDesc': 'Name shown in the dropdown',
  'rednoteSettings.fontValueName': 'Font value',
  'rednoteSettings.fontValueDesc': 'Value for the CSS font-family property',
  // ThemePreviewModal：标题与示例内容
  'rednoteSettings.themePreviewTitle': 'Theme preview: {name}',
  'rednoteSettings.avatarAlt': 'User avatar',
  'rednoteSettings.previewSampleHeading': 'Explore endless ways to lay out your cards',
  'rednoteSettings.previewSampleParaStart': 'The plugin gives you ',
  'rednoteSettings.previewSampleParaStrong': 'elegant tools,',
  'rednoteSettings.previewSampleParaEnd': ' helping you publish notes with ease.',
  'rednoteSettings.previewSampleListOne': 'Customize theme styles with ease',
  'rednoteSettings.previewSampleListTwo': 'Preview themes in real time',
  'rednoteSettings.previewSampleQuote': '“Posting notes has never been this simple.”',
  'rednoteSettings.previewSampleCode': '// Welcome to Xiaohongshu cards\nconsole.log("Posting notes made simple");',
  'rednoteSettings.previewSampleTip': 'If this plugin helps you, consider leaving a tip to support it.',
});
