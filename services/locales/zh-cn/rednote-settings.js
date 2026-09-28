// services/locales/zh-cn/rednote-settings.js —— 命名空间 rednote-settings 的简体中文文案（3.12.0）。key 与另一语言文件一一对应，tests/i18n.test.js 校验。
// 覆盖 rednote/settings/ 下的 RedSettingsPanel / ConfirmModal / CreateFontModal / ThemePreviewModal（CreateThemeModal 未迁）。

/** @type {Readonly<Record<string, string>>} */
export default Object.freeze({
  // RedSettingsPanel：分区与子分区标题
  'rednoteSettings.sectionBasic': '基本设置',
  'rednoteSettings.sectionTheme': '主题设置',
  'rednoteSettings.typographyHeading': '排版管理',
  'rednoteSettings.fontHeading': '字体管理',
  'rednoteSettings.visibilityHeading': '显示设置',
  'rednoteSettings.hiddenThemesHeading': '隐藏主题',
  'rednoteSettings.visibleThemesHeading': '显示主题',
  'rednoteSettings.customThemesHeading': '自定义主题',
  // RedSettingsPanel：标题级别
  'rednoteSettings.headingLevelName': '内容分割标题级别',
  'rednoteSettings.headingLevelDesc': '选择用于分割内容生成图片的标题级别：',
  'rednoteSettings.headingLevelH1': '一级标题(#) - 按大章节分割',
  'rednoteSettings.headingLevelH2': '二级标题(##) - 按小章节分割',
  'rednoteSettings.headingLevelUpdatedNotice': '标题级别设置已更新，请重启 Obsidian 或重新加载以使更改生效',
  // RedSettingsPanel：显示开关
  'rednoteSettings.showTimeName': '是否显示时间',
  'rednoteSettings.showTimeDesc': '控制是否在主题中显示页眉时间',
  'rednoteSettings.showHeaderName': '是否显示页眉',
  'rednoteSettings.showHeaderDesc': '控制是否在图卡顶部显示头像、昵称、时间；关闭后正文区上移',
  'rednoteSettings.showFooterName': '是否显示页脚',
  'rednoteSettings.showFooterDesc': '控制是否在主题中显示页脚部分',
  // RedSettingsPanel：按钮、提示与确认弹窗
  'rednoteSettings.editTooltip': '编辑',
  'rednoteSettings.deleteTooltip': '删除',
  'rednoteSettings.previewTooltip': '预览',
  'rednoteSettings.addFontButton': '+ 添加字体',
  'rednoteSettings.addThemeButton': '+ 新建主题',
  'rednoteSettings.reloadNotice': '请重启 Obsidian 或重新加载以使更改生效',
  'rednoteSettings.confirmDeleteFontTitle': '确认删除字体',
  'rednoteSettings.confirmDeleteFontMessage': '确定要删除「{name}」字体配置吗？',
  'rednoteSettings.confirmDeleteThemeTitle': '确认删除主题',
  'rednoteSettings.confirmDeleteThemeMessage': '确定要删除「{name}」主题吗？此操作不可恢复。',
  // ConfirmModal / CreateFontModal 按钮
  'rednoteSettings.cancelButton': '取消',
  'rednoteSettings.confirmButton': '确认',
  'rednoteSettings.okButton': '确定',
  // CreateFontModal
  'rednoteSettings.fontModalEditTitle': '编辑字体',
  'rednoteSettings.fontModalAddTitle': '添加字体',
  'rednoteSettings.fontModalHelp': `👋 字体值设置说明
                                    • 单个字体：填写一个字体名即可，如 "微软雅黑"
                                    • 中文字体：可再补上英文名以提高兼容性，英文名不区分大小写，如 simsun
                                    • 字体族：末尾添加 serif/sans-serif 作为回退
                                    • 多个字体用逗号分隔
                                    示例
                                    • 宋体：simsun, "宋体", serif
                                    • 微软雅黑："微软雅黑", sans-serif`,
  'rednoteSettings.fontNameName': '字体名称',
  'rednoteSettings.fontNameDesc': '显示在下拉菜单中的名称',
  'rednoteSettings.fontValueName': '字体值',
  'rednoteSettings.fontValueDesc': 'CSS font-family 的值',
  // ThemePreviewModal：标题与示例内容
  'rednoteSettings.themePreviewTitle': '主题预览: {name}',
  'rednoteSettings.avatarAlt': '用户头像',
  'rednoteSettings.previewSampleHeading': '探索图卡排版的无限可能',
  'rednoteSettings.previewSampleParaStart': '插件提供多种',
  'rednoteSettings.previewSampleParaStrong': '优雅的操作，',
  'rednoteSettings.previewSampleParaEnd': '助您轻松发布笔记。',
  'rednoteSettings.previewSampleListOne': '轻松定制主题样式',
  'rednoteSettings.previewSampleListTwo': '实时预览主题效果',
  'rednoteSettings.previewSampleQuote': '“让笔记发帖变得如此简单。”',
  'rednoteSettings.previewSampleCode': '// 欢迎使用小红书图卡\nconsole.log("让笔记发帖更简单");',
  'rednoteSettings.previewSampleTip': '如果您觉得我的插件对您有帮助，请打赏支持我。',
});
