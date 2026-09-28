// services/locales/en/feishu.js —— 命名空间 feishu 的英文文案（3.12.0）。key 与另一语言文件一一对应，tests/i18n.test.js 校验。

/** @type {Readonly<Record<string, string>>} */
export default Object.freeze({
  // 统计卡片
  'feishu.statsHeading': 'Statistics',
  'feishu.sharedDocsName': 'Shared documents',
  'feishu.sharedDocsDesc': 'Documents successfully shared: {count}.',
  'feishu.apiUsageName': 'API calls this month',
  'feishu.apiUsageDesc': 'The plugin estimates {used} / {limit} calls used, with about {remaining} remaining.',
  'feishu.resetUsageButton': 'Reset counter',
  'feishu.resetUsageNotice': '✅ Feishu API call counter has been reset',
  'feishu.usagePeriodNote': 'Period: {month}. This only counts Feishu OpenAPI requests made by this plugin; check the Feishu Open Platform console for your actual quota.',

  // 页头
  'feishu.intro': 'Configure your Feishu custom app, target folder and OpenAPI usage statistics.',
  'feishu.heading': 'Feishu cloud document sync',
  'feishu.headingDesc': 'Publish the current Obsidian note as a native Feishu cloud document (docx) in one click through a Feishu custom app bot. Headings, tables and image uploads (both local and hosted images) are preserved.',

  // 设置项
  'feishu.enableName': 'Enable Feishu sync',
  'feishu.enableDesc': 'When enabled, a "Feishu" tab appears in the publish dialog so you can publish notes to your Feishu drive.',
  'feishu.appIdName': 'Feishu custom app ID',
  'feishu.appIdDesc': 'The app ID of the custom app you created on the Feishu Open Platform (open.feishu.cn)',
  'feishu.appIdPlaceholder': 'Enter the app ID',
  'feishu.appSecretName': 'Feishu custom app secret',
  'feishu.appSecretDesc': 'The app secret credential of your custom app',
  'feishu.appSecretPlaceholder': 'Enter the app secret',
  'feishu.folderTokenName': 'Target folder token',
  'feishu.folderTokenDesc': 'The string at the end of a Feishu folder link. For example, in feishu.cn/drive/folder/fldcnxxxxxxxxx the folder token is fldcnxxxxxxxxx.',
  'feishu.folderTokenPlaceholder': 'Enter the folder token',
  'feishu.userIdName': 'Feishu user ID',
  'feishu.userIdDesc': 'After a successful sync, ownership of the document is transferred from the bot to you (in your Feishu drive). Use the user ID format, for example abc1234.',
  'feishu.userIdPlaceholder': 'For example abc1234',

  // 测试连接
  'feishu.testConnectionName': 'Test connection',
  'feishu.testConnectionDesc': 'Verifies the custom app credentials and read access to the target folder. Full upload/import permissions are verified during an actual sync.',
  'feishu.testConnectionButton': 'Test connection',
  'feishu.noticeMissingCredentials': '❌ Please enter the app ID and app secret first!',
  'feishu.noticeMissingFolderToken': '❌ Please enter the target folder token first!',
  'feishu.noticeTesting': '⏳ Testing the Feishu connection...',
  'feishu.noticeTestSuccess': '✅ Connected to Feishu, and the target folder is accessible!',
  'feishu.noticeTestFailed': '❌ Feishu connection test failed: {message}',

  // 配置步骤
  'feishu.guideTitle': 'Quick setup steps for the Feishu app:',
  'feishu.step1Before': 'Go to ',
  'feishu.step1Link': 'Feishu Open Platform',
  'feishu.step1After': ', create a custom app, and enable the "Bot" capability under "App features".',
  'feishu.step2': 'Open "Permissions & scopes" and grant permissions generously: grant all "Docs"-related scopes to the app identity and all scopes to the user identity. This minimizes 403 / insufficient-permission errors when importing, updating, processing images or transferring ownership. Then go to "Version management & release" to request publishing (requires admin approval).',
  'feishu.step2AppScopeCode': 'App identity',
  'feishu.step2AppScopeDesc': 'Grant all docs / drive related scopes',
  'feishu.step2UserScopeCode': 'User identity',
  'feishu.step2UserScopeDesc': 'Grant all scopes to avoid permission boundary errors',
  'feishu.step2MinScopeCode': 'At minimum',
  'feishu.step2MinScopeDesc': 'drive:drive, docs:document:import and other document import and drive read/write scopes',
  'feishu.step3Before': 'In the Feishu client, create a group chat, add your custom bot, and share the sync folder with that group. The collaboration permission must be set to ',
  'feishu.step3Strong': '"Can manage"',
  'feishu.step3After': '.',
});
