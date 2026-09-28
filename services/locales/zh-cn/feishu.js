// services/locales/zh-cn/feishu.js —— 命名空间 feishu 的简体中文文案（3.12.0）。key 与另一语言文件一一对应，tests/i18n.test.js 校验。

/** @type {Readonly<Record<string, string>>} */
export default Object.freeze({
  // 统计卡片
  'feishu.statsHeading': '数据统计',
  'feishu.sharedDocsName': '分享文档数',
  'feishu.sharedDocsDesc': '您已成功分享 {count} 个文档。',
  'feishu.apiUsageName': '本月 API 调用次数',
  'feishu.apiUsageDesc': '插件估算已调用 {used} / {limit} 次，剩余约 {remaining} 次。',
  'feishu.resetUsageButton': '重置计数',
  'feishu.resetUsageNotice': '✅ 飞书 API 调用计数已重置',
  'feishu.usagePeriodNote': '统计周期：{month}。该数据仅统计本插件发起的飞书 OpenAPI 请求，实际额度请以飞书开放平台后台为准。',

  // 页头
  'feishu.intro': '配置飞书自建应用、目标文件夹和 OpenAPI 调用统计。',
  'feishu.heading': '飞书云文档同步配置',
  'feishu.headingDesc': '通过飞书自建应用机器人接口，将当前 Obsidian 笔记一键发布并转换为原生的飞书云文档（docx），支持保留标题、表格、以及图片上传（包含本地和图床图片）。',

  // 设置项
  'feishu.enableName': '启用飞书同步功能',
  'feishu.enableDesc': '开启后，发布弹窗中会出现「飞书」选项卡，支持将笔记发布至飞书云盘。',
  'feishu.appIdName': '飞书自建应用 ID',
  'feishu.appIdDesc': '在飞书开放平台（open.feishu.cn）中，您创建的企业自建应用的应用 ID',
  'feishu.appIdPlaceholder': '请输入应用 ID',
  'feishu.appSecretName': '飞书自建应用密钥',
  'feishu.appSecretDesc': '自建应用的应用密钥凭证',
  'feishu.appSecretPlaceholder': '请输入应用密钥',
  'feishu.folderTokenName': '同步目标文件夹 token',
  'feishu.folderTokenDesc': '飞书文件夹链接末尾的一串字符。例如链接 feishu.cn/drive/folder/fldcnxxxxxxxxx 中，fldcnxxxxxxxxx 就是文件夹 token。',
  'feishu.folderTokenPlaceholder': '请输入文件夹 token',
  'feishu.userIdName': '飞书用户 ID',
  'feishu.userIdDesc': '用于在同步成功后，把文档的所有权由机器人自动转移给您本人（您的飞书云盘中）。建议使用 user ID 格式，如 abc1234。',
  'feishu.userIdPlaceholder': '例如 abc1234',

  // 测试连接
  'feishu.testConnectionName': '测试连接',
  'feishu.testConnectionDesc': '验证自建应用授权和目标文件夹读取权限。完整上传/导入权限会在实际同步时验证。',
  'feishu.testConnectionButton': '测试连接',
  'feishu.noticeMissingCredentials': '❌ 请先填写应用 ID 和应用密钥！',
  'feishu.noticeMissingFolderToken': '❌ 请先填写同步目标文件夹 token！',
  'feishu.noticeTesting': '⏳ 正在进行飞书连接测试...',
  'feishu.noticeTestSuccess': '✅ 飞书连接成功，且目标文件夹访问正常！',
  'feishu.noticeTestFailed': '❌ 飞书连接测试失败: {message}',

  // 配置步骤
  'feishu.guideTitle': '飞书应用配置简易步骤：',
  'feishu.step1Before': '访问 ',
  'feishu.step1Link': '飞书开放平台',
  'feishu.step1After': ' 创建自建应用，并在「应用功能」中启用「机器人」能力。',
  'feishu.step2': '进入「权限管理」，建议按更稳妥的方式开通权限：应用身份开通「云文档」相关全部权限，用户身份开通全部权限。这样可最大限度避免导入、更新、图片处理或所有权转移时遇到 403/权限不足。完成后点击「版本管理与发布」申请上线（需管理员审批）。',
  'feishu.step2AppScopeCode': '应用身份',
  'feishu.step2AppScopeDesc': '开通云文档 / 云空间相关全部权限',
  'feishu.step2UserScopeCode': '用户身份',
  'feishu.step2UserScopeDesc': '建议开通全部权限，减少权限边界导致的异常',
  'feishu.step2MinScopeCode': '至少包含',
  'feishu.step2MinScopeDesc': 'drive:drive、docs:document:import 等文档导入与云盘读写权限',
  'feishu.step3Before': '在飞书客户端新建群聊，添加自建机器人，并将云盘同步文件夹共享给该群，协作权限必须选择 ',
  'feishu.step3Strong': '「可管理」',
  'feishu.step3After': ' 权限。',
});
