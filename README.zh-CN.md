# Note Content Studio

> 版本 3.11.6 · 更新 2026-09-15 · [English](./README.md) · [爱发电支持作者](https://afdian.com/a/note_content_studio)

把 Obsidian 笔记变成可直接发布的内容：**微信公众号**文章、**小红书**图文卡片、**飞书**云文档，全部在 Obsidian 内实时预览。

## 功能

- **公众号文章**：Markdown 实时预览为公众号排版效果（代码块、引用、本地图片、GIF、公式与图表全部适配），一键复制进公众号编辑器，或直接保存到账号草稿箱。
- **小红书图文卡片**：预览切到「小红书」模式，每个标题生成一张图卡，可选多套主题（含 iOS 备忘录风格），导出 PNG。
- **飞书云文档**：同一篇笔记同步到飞书云文档。
- **AI 编排与标题润色**（可选）：用你自己的 API Key 做 AI 排版与标题建议。
- **小红书 / X 草稿发布**（可选）：通过配套浏览器扩展把渲染好的图卡推送到平台草稿箱。

## 快速上手

1. 点击侧边栏 **Content Studio** 图标（或运行命令「打开预览面板」）打开预览面板；
2. 编辑笔记，面板实时渲染，双向同步滚动；
3. 顶栏切换平台（公众号 / 小红书 / X）、调整样式，通过「**发布与分发**」发布。

## 配置

- **公众号**：在设置中填入 AppID/Secret。微信 API 有 IP 白名单限制，请求需经**你自己部署的代理**转发，见 [API 代理设置](./docs/guides/api-proxy.md)；仓库 [`server/`](./server/README.md) 内附一份可直接部署的代理服务。
- **飞书**：在设置中填入飞书应用凭证。
- **AI 功能**（可选）：在设置中配置 AI Provider 与 API Key，见 [AI Provider 设置](./docs/guides/ai-provider.md)。
- **小红书 / X 草稿发布**（可选，按日计量）：需要配套浏览器扩展 **Crosspost**，该扩展单独分发、目前尚未公开发布。没有扩展时其余功能不受影响：图卡预览、PNG/ZIP 导出、复制均可用。
  发布按日计量：**Free** 每日 3 次，**Pro** 每日 30 次，**Max** 不限。Pro / Max 为付费许可，在 [爱发电](https://afdian.com/a/note_content_studio) 购买（海外的 Lemon Squeezy 渠道稍后开通），密钥填在 设置 → 分发设置 → 其他平台。详见 [额度与许可](./docs/guides/quota-and-license.md)。

## 网络访问与隐私

插件只在你主动触发操作时联网，且只访问你自己配置的服务：

- **微信 API**（`api.weixin.qq.com`）：经你设置的代理地址，在上传图片、保存草稿到公众号时访问。
- **飞书开放平台**（`open.feishu.cn`）：同步笔记到飞书时访问；飞书同步中的 Mermaid 图通过 `kroki.io` 远程渲染。
- **你配置的 AI 服务端点**（DeepSeek / OpenAI 兼容 / Anthropic 兼容，取决于你的设置）：执行 AI 编排或标题润色时访问。
- **本机 WebSocket 服务**（`127.0.0.1:9527`，端口可改）：用于配对可选的 Crosspost 扩展，仅在设置里开启多平台发布后启动，只接受本机连接。
- **许可服务**（`api.runfast.xyz/license`）：小红书 / X 发布计量用。扩展只发送匿名设备 ID、许可密钥（如有）和平台名做计数；插件仅在用爱发电订单号兑换密钥时访问。不发送任何笔记内容。

凭证（AppID/Secret、Token、API Key、许可密钥）保存在 vault 内插件目录的 `data.json`，只发送给上述服务。没有任何遥测或统计上报。**超出免费每日额度的小红书 / X 发布需要付费许可。**

## 手动安装

从最新 Release 下载 `main.js` / `manifest.json` / `styles.css` 放入 `.obsidian/plugins/note-content-studio/`，然后启用插件。

## 文档

[`docs/guides/`](./docs/guides/) 内有代理设置、AI Provider 设置、小红书图文发布说明。

## 支持作者

Note Content Studio 免费、MIT 开源，由 [runnerback](https://github.com/runnerback) 开发维护。如果它帮你省了时间，欢迎在 **爱发电** 支持：https://afdian.com/a/note_content_studio 。同一页面出售小红书 / X 发布计量的 Pro / Max 许可，其余功能全部免费。

## 致谢

基于 DavidLam 的 [obsidian-wechat-converter](https://github.com/davidlam-oss/obsidian-wechat-converter) 开发，并移植了 Yeban 的 [note-to-red](https://github.com/yeban8090/note-to-red) 渲染引擎（TypeScript 版），两者均为 MIT 许可，原始版权声明保留在 [LICENSE](./LICENSE) 中。

## 许可证

[MIT](./LICENSE)
