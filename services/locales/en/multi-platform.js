// services/locales/en/multi-platform.js —— 命名空间 multi-platform 的英文文案（3.12.0）。key 与另一语言文件一一对应，tests/i18n.test.js 校验。
// 覆盖「小红书 / X（浏览器扩展）」设置子页面（views/settings/multi-platform-tab.js）以及发布弹窗里的扩展未发行提示。

/** @type {Readonly<Record<string, string>>} */
export default Object.freeze({
  // 页面引导与标题
  'multiPlatform.intro': 'Connect the browser extension and choose the platforms to save drafts to.',
  'multiPlatform.headingName': 'Browser extension publishing',
  'multiPlatform.headingDesc': 'Obsidian handles writing, preview and platform selection; the browser extension uses your current browser sign-in to save articles to the Xiaohongshu and X draft boxes. WeChat official accounts go through the official account API above.',

  // 配套扩展引导（已发行 / 未发行两种）
  'multiPlatform.onboardingTitle': 'Multi-platform publishing relies on the companion browser extension "{name}"',
  'multiPlatform.onboardingStepInstall': 'Install: get the extension from the browser web store.',
  'multiPlatform.onboardingStepPair': 'Pair: open the extension popup → settings → copy the connection token and paste it below; pairing completes once both tokens match.',
  'multiPlatform.onboardingStepPublish': 'Publish: pick Xiaohongshu or X under "Publish and distribute"; the cards and body are saved to the draft box through the extension using your browser sign-in.',
  'multiPlatform.extensionUnreleasedTitle': 'The browser extension "{name}" has not been released yet',
  'multiPlatform.extensionUnreleasedDesc': 'Publishing Xiaohongshu / X drafts relies on this extension, which is still in private testing by the author and not yet listed in browser web stores. Once released, this page will show the install link and pairing steps. Without it, card preview, PNG / ZIP export and copying all still work.',

  // 开关与连接参数
  'multiPlatform.enableName': 'Enable browser extension publishing',
  'multiPlatform.enableDescReleased': 'When enabled, Obsidian sends articles to the browser extension, which saves them to each platform draft box using your browser sign-in. Enter the connection token below to finish pairing.',
  'multiPlatform.enableDescUnreleased': 'The extension is not released yet, so most users do not need to turn this on. If you have the beta extension, turn it on and enter the connection token below to finish pairing.',
  'multiPlatform.portName': 'Local service port',
  'multiPlatform.portDesc': 'Defaults to 9527. Change it only if the local service address in the browser extension uses a different port.',
  'multiPlatform.tokenName': 'Connection token',
  'multiPlatform.tokenDesc': 'Enter the connection token shown by the browser extension local service to confirm that Obsidian and the extension belong to the same connection.',
  'multiPlatform.tokenPlaceholder': 'Paste the connection token shown in the extension popup',

  // 许可密钥兑换与额度
  'multiPlatform.redeemName': 'Step 1: redeem a key with your Afdian order number',
  'multiPlatform.redeemDesc': 'Xiaohongshu / X publishing is metered per day; the free tier allows 3 per day. After buying a paid tier on Afdian, paste the order number here and click "Redeem"; the license key is filled in below automatically.',
  'multiPlatform.redeemPlaceholder': 'Afdian order number',
  'multiPlatform.redeemButton': 'Redeem',
  'multiPlatform.redeemNoNetwork': '❌ Network requests are not available in this environment, so the key cannot be redeemed',
  'multiPlatform.redeemSuccess': '✅ Redeemed a {tier} license and filled in the license key below',
  'multiPlatform.redeemSuccessWithExpiry': '✅ Redeemed a {tier} license and filled in the license key below, valid until {date}',
  'multiPlatform.redeemFailed': '❌ Redeem failed: {message}',
  'multiPlatform.licenseKeyName': 'Step 2: license key (paid tiers)',
  'multiPlatform.licenseKeyDesc': 'Filled in automatically after redeeming; you can also paste an existing key. Leave it empty to use the free tier (3 per day); daily limits for paid tiers are listed in the tier line below.',
  'multiPlatform.licenseKeyPlaceholder': 'Filled in automatically after redeeming, or paste an existing key',
  'multiPlatform.quotaLabel': 'Quota',
  'multiPlatform.tierLoading': 'Tiers: loading…',
  'multiPlatform.quotaOffline': 'Connect the browser extension to see your current plan, usage today and expiry date.',
  'multiPlatform.quotaLoading': 'Loading current plan…',
  'multiPlatform.quotaBuy': 'Buy Pro / Max',
  'multiPlatform.quotaRenew': 'Renew / upgrade',
  'multiPlatform.quotaFailed': 'Failed to load current plan: {message}',
  'multiPlatform.tierLine': 'Tiers: {tiers}',
  'multiPlatform.tierFailed': 'Tiers: {message}',
  'multiPlatform.tierNoNetwork': 'Tiers: network requests are not available in this environment',

  // 统一连接状态栏
  'multiPlatform.browserFallback': 'Browser',
  'multiPlatform.timeJustNow': 'just now',
  'multiPlatform.timeMinutesAgo': '{count} min ago',
  'multiPlatform.timeHoursAgo': '{count} hr ago',
  'multiPlatform.timeDaysAgo': '{count} d ago',
  'multiPlatform.statusTokenMissing': 'Missing',
  'multiPlatform.statusTokenMissingDesc': 'No connection token yet. Copy the token from the browser extension popup.',
  'multiPlatform.statusReady': 'Ready',
  'multiPlatform.statusDisconnected': 'Disconnected',
  'multiPlatform.statusDisconnectedDesc': ' Disconnected. Restart the browser extension to reconnect.',
  'multiPlatform.statusConnectedChecked': 'Browser extension connected and ready to publish. Last checked {checkedAt}.',
  'multiPlatform.statusConnected': 'Browser extension connected and ready to publish.',
  'multiPlatform.statusFailed': 'Connection failed',
  'multiPlatform.statusFailedDescWithMessage': '{message}. Check the port and token, then click "Test connection".',
  'multiPlatform.statusFailedDesc': 'Check the port and token, then click "Test connection".',
  'multiPlatform.statusWaiting': 'Waiting',
  'multiPlatform.statusWaitingDesc': 'Token entered. Click "Test connection" below to confirm the connection.',

  // 发布平台区块
  'multiPlatform.platformsTitle': 'Publishing platforms',
  'multiPlatform.platformsDesc': 'These platforms are connected and can be chosen under "Publish and distribute"; more platforms are planned.',
  'multiPlatform.platformsEmpty': 'No connected platforms loaded yet. Click "Test connection" below.',
  'multiPlatform.platformEnabledTitle': '{name} · connected',
  'multiPlatform.plannedSummary': 'Planned ({count})',
  'multiPlatform.platformPlannedTitle': '{name} (planned)',
  'multiPlatform.platformPlannedStatus': 'Planned',

  // 测试连接
  'multiPlatform.testConnectionName': 'Test connection',
  'multiPlatform.testConnectionDesc': 'Check that Obsidian can reach the browser extension, then check the sign-in status of each connected platform (Xiaohongshu, X).',
  'multiPlatform.testButton': 'Test',
  'multiPlatform.testButtonWaiting': 'Waiting for extension...',
  'multiPlatform.errorTokenInvalid': 'Connection token check failed. Make sure Obsidian and the browser extension use the same connection token.',
  'multiPlatform.errorHealthFailed': 'Browser extension health check failed',
  'multiPlatform.connectedWithAuth': 'Connected, and the sign-in status of each publishing platform has been checked.',
  'multiPlatform.connectedTokenVerified': 'Connected; the connection token passed the extension check. Platform sign-in status was not detected.',
  'multiPlatform.connectedNoHealth': 'Connected. This extension version has no health check, so platform sign-in status was not checked automatically.',
  'multiPlatform.noticeConnectedVerified': '✅ Browser extension connected; connection token verified',
  'multiPlatform.noticeConnected': '✅ Browser extension connected',
  'multiPlatform.errorConnectFailed': 'Browser extension connection failed',
  'multiPlatform.errorTokenMismatch': 'Pairing tokens do not match. If you just reset the token in the browser extension settings, copy the new token and paste it into the connection token field below.',
  'multiPlatform.errorHelloTimeout': 'The browser extension connected but did not finish the handshake in time. The extension may be outdated or the handshake may be disabled.',
  'multiPlatform.errorInvalidPayload': 'The browser extension sent a malformed handshake. Upgrade the browser extension to a version that supports the secure handshake.',
  'multiPlatform.errorVersionUnsupported': 'The browser extension version is not compatible with Obsidian and the handshake was rejected. Upgrade the browser extension.',
  'multiPlatform.errorHelloRejected': 'Browser extension handshake failed ({reason}). Check the browser extension version and the connection token.',
  'multiPlatform.hintCheckBridge': 'Make sure the browser is running with the extension installed, and that the address, port and connection token match the values here.',
  'multiPlatform.errorNotAuthenticated': 'The browser extension is connected but not yet authenticated. Make sure the extension is upgraded to a version with the secure handshake and uses the same connection token as Obsidian.',
  'multiPlatform.noticeTestFailed': '❌ {message}',

  // Extension self-check (protocol v1.1 health.adapters)
  'multiPlatform.healthCheckedAt': 'Extension self-check at {time}',
  'multiPlatform.healthLastPublishOk': 'Last publish succeeded · {time}',
  'multiPlatform.healthLastPublishFailed': 'Last publish failed · {time} · {error}',
  'multiPlatform.healthCreatorTabClosed': 'Creator publish page is not open',
});
