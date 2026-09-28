# Changelog / 更新日志

> 版本 v1.1 ｜ 更新时间 2026-09-28 ｜ 面向用户的变更记录（中英）。每个版本的英文详情见 `RELEASE_NOTES/v<version>.md`。

## 3.12.1（2026-09-28）

**中文**

- 扩展结果回推：Crosspost 3.1.0（桥接协议 v1.1）起写完草稿会把每个平台的结果推回 Obsidian，frontmatter 自动从「待确认」变为已确认（`platform_<name>: 1`）或 `publish_failed`，分发看板同步显示失败；Obsidian 重启后收到的结果只提示不改文档。旧扩展保持 3.12.0 行为（一直待确认，需自行到草稿箱核对）。
- 设置页「测试连接」显示扩展自检：每个平台的探针结论（登录态、创作者页是否打开、X 写草稿接口是否与前端一致）与最近一次发布结果，来自扩展的 `health.adapters`；旧扩展不显示。
- 桥接协议主版本校验：扩展握手上报 `protocolVersion`，主版本不同则拒绝并提示更新扩展或插件。

**English**

- Result push-back from Crosspost 3.1.0+ (bridge protocol v1.1): per-platform outcomes update the note's frontmatter from pending to confirmed or `publish_failed`; the dashboard shows failures.
- "Test connection" shows the extension's self-check per platform (sign-in, creator tab, X draft endpoint) and the last publish outcome (`health.adapters`).
- Handshake rejects a different protocol major version and asks to update the extension or the plugin.

## 3.12.0（2026-09-28）

**中文**

- 包体从 3.8MB 降到 1.3MB：公式改用 Obsidian 自带 MathJax 渲染（不再打包 SVG 引擎），复制到公众号 / API 存草稿时才把公式转成 PNG；小红书内置背景图改为 WebP。
- 改为桌面版专用（`isDesktopOnly: true`）：本机桥接与飞书图片处理依赖桌面能力，手机端此前会崩。
- 扩展未发行前如实标注：设置页与发布弹窗说明「浏览器扩展尚未发行」，不再给出构建 / 加载已解压的步骤；经扩展投递的小红书 / X 记为「已投递，等待确认」（frontmatter `publish_status: pending`、`publish_pending`），不再先报 ✅。
- 设置收口：手机仿真框、图片水印挪到预览面板「样式设置 → 高级选项」，改动即时生效；删除无界面的飞书设置与旧单账号字段；扩展页改名「小红书 / X（浏览器扩展）」。
- 设置项、命令与小红书图卡设置随 Obsidian 语言切换：中文（简体 / 繁体）→ 简体中文，其它 → 英文。
- 新增分发看板（命令「打开分发看板」、预览面板顶栏按钮）：按笔记列出目标平台（`platform`，支持数组一稿多发）、已发布 / 待确认 / 未发布与最近时间，可按平台、状态、关键词筛选。
- AI 编排费用可见：每次编排的 token 数、本机累计用量与单价估算（设置 → AI）；技能更新后的旧缓存标「技能已更新」。
- 代码结构：入口文件与 AI 编排服务拆分为职责单一的模块；文档（CLAUDE.md、CONTRIBUTING、RELEASING、使用指南）全部更新。

**English**

- Bundle 3.8 MB → 1.3 MB: math renders with Obsidian's built-in MathJax; formulas become PNG only when exporting to WeChat. Built-in card backgrounds re-encoded to WebP.
- Desktop only (`isDesktopOnly: true`).
- Honest status for the unreleased Crosspost extension; extension deliveries are recorded as pending instead of a confirmed draft.
- Settings consolidated: phone frame and watermark live in the preview panel's advanced options and apply instantly; dead settings removed; extension page renamed "Xiaohongshu / X (browser extension)".
- Settings, commands and card settings follow Obsidian's language (Chinese → Simplified Chinese, others → English).
- New publishing dashboard with per-note targets, published / awaiting / not-yet columns and filters.
- AI layout token usage per run, per-device totals with an optional cost estimate; layouts from an outdated skill version are flagged.
- Entry file and AI layout service split into focused modules; docs refreshed.

## 3.11.x（2026-09-15 → 2026-09-24）

- 3.11.17 / 3.11.16：按文档属性 `platform` 自动切换预览平台（设置项在样式设置一级）。
- 3.11.15 / 3.11.14 / 3.11.12：Obsidian 社区目录扫描问题清零，无任何抑制。
- 3.11.11：发布 workflow 先建草稿 Release，确认资产齐全再发布。
- 3.11.10：图卡内图文混排、自动拆卡；X 限 4 张。
- 3.11.9：ZIP 内文件夹按笔记命名。
- 3.11.8：用 fflate 替换 jszip。
- 3.11.7：自动审核修复，main.js 5.0MB → 3.8MB，LICENSE 改为纯 MIT。
- 3.11.4 – 3.11.6：设置重组为样式 / 分发 / AI 三组；许可改为先兑换订单号；密钥下方显示额度。
- 3.11.2 / 3.11.3：上架社区目录首版；小红书 / X 发布按日计量（Free 3 / Pro 30 / Max 不限）。
