# Crosspost Privacy Policy / 多栖 Crosspost 隐私政策

> Updated 2026-11-11 · Applies to extension version 3.1.0 and later · [中文见下方](#多栖-crosspost-隐私政策)
>
> Crosspost is the companion browser extension of the Obsidian plugin Note Content Studio (this repository). It saves the articles you push from Obsidian into your Xiaohongshu / X drafts. The same policy is also served at https://runfast.ren/crosspost/privacy.

## Crosspost Privacy Policy

1. **Single purpose.** The extension does one thing: it saves articles pushed from the Obsidian plugin "Note Content Studio" over a local WebSocket (`127.0.0.1`) into your Xiaohongshu / X drafts, using the accounts you are already signed in to in this browser. Nothing is published automatically; you review and post the draft yourself.
2. **Data read.** Your Xiaohongshu and X sign-in cookies, only to detect sign-in state and write drafts as you; the title, body and images of the article you push from Obsidian, only while the draft is being written, and discarded afterwards.
3. **Data sent to the author's server (api.runfast.ren).** An anonymous device ID, your license key if you entered one, the target platform name and a timestamp, used to count the free / paid quota. Article content, cookies and account details are never sent.
4. **No third parties.** No analytics, ads or crash reporting. To keep up with changes in X's web app, the extension downloads public JavaScript files from x.com; that request carries none of your data.
5. **Local storage.** The pairing token, device ID and the last 25 sync records (title and result, no images) stay in the browser's extension storage and are deleted when you uninstall.
6. **Permissions.** `cookies`: read sign-in state for the two sites above; `scripting` / `tabs`: write the draft in the Xiaohongshu Creator Center tab; `declarativeNetRequest`: set request headers when writing X drafts; `alarms`: daily sign-in self-check; `storage`: keep the local data above.
7. **Contact.** [boodorg@gmail.com](mailto:boodorg@gmail.com). Under GPL-3.0, the complete corresponding source code of any released version is available free of charge on request to this address for three years from its release.

## 多栖 Crosspost 隐私政策

> 更新日期：2026-11-11 · 适用扩展版本 3.1.0 及以上 · 同一份政策也发布在 https://runfast.ren/crosspost/privacy

1. **唯一功能**。本扩展只做一件事：把 Obsidian 插件「Note Content Studio」通过本机 WebSocket（`127.0.0.1`）推送的文章，用你在浏览器里已登录的账号写入小红书 / X 的草稿箱。不会自动发布，是否发布由你在平台上自行确认。
2. **读取的数据**。小红书与 X 的登录 Cookie，仅用于判断登录状态与以你的身份写草稿；你从 Obsidian 推送的文章标题、正文、图片，仅在写草稿时使用，写完即丢弃。
3. **发送到作者服务器（api.runfast.ren）的数据**。匿名设备 ID、许可密钥（如你填写）、目标平台名与时间，用于计数免费 / 付费额度。不发送文章内容、Cookie 或账号信息。
4. **不发送给任何第三方**。没有统计、广告或崩溃上报。为了跟进 X 前端接口变化，扩展会下载 x.com 的公开 JS 文件，该请求不携带你的任何数据。
5. **本地存储**。配对令牌、设备 ID、最近 25 条同步记录（标题与结果，不含图片）保存在浏览器扩展存储中，卸载扩展即删除。
6. **权限用途**。`cookies`：读取上述两个站点的登录态；`scripting` / `tabs`：在小红书创作者中心页面写入草稿；`declarativeNetRequest`：向 X 写草稿时补请求头；`alarms`：每日自检登录态；`storage`：保存上述本地数据。
7. **联系方式**。[boodorg@gmail.com](mailto:boodorg@gmail.com)。按 GPL-3.0，自任一版本发布起三年内向此邮箱索取，可免费获得该版本对应的完整源码。
