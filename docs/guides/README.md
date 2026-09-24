# 使用说明 Guides

> 适用插件版本：v3.11.4 ｜ 最后更新：2026-09-15 ｜ 编码：UTF-8

「Content Studio」的功能使用说明，按主题拆分。

## 目录

| 文档 | 内容 |
|------|------|
| [API 代理设置](./api-proxy.md) | 配置 API 代理地址，解决本机 IP 变化导致的微信 IP 白名单漂移、同步失败 |
| [AI Provider 设置](./ai-provider.md) | 配置 AI Provider（DeepSeek），启用「AI 编排」和「标题 AI 润色」 |
| [小红书图文发布](./rednote-publishing.md) | 预览区「小红书」模式：图卡预览/导出，一键发布图文笔记到小红书草稿箱 |
| [额度与许可](./quota-and-license.md) | 小红书 / X 发布按日计量：Free / Pro / Max 档位、购买与兑换密钥、额度显示与常见问题 |

## 设置面板速览

打开：Obsidian 设置 → 第三方插件 → Note Content Studio（或转换器面板右上角齿轮）。

> v3.11.4 起（要求 Obsidian ≥ 1.13.0）设置面板按 **样式 / 分发 / AI** 三组排布，每组内是子页面，点击进入、左上角返回；所有项都能在 Obsidian 设置搜索里直达。

| 组 | 子页面 | 内容 |
|---|---|---|
| **样式设置** | 公众号排版 | 预览模式（手机仿真框、按文档属性 `platform` 自动切换预览平台）、图片水印（头像上传 / 清除 / 备用 URL） |
| | 小红书图卡 | 图卡用户信息（头像 / 昵称 / ID / 时间）、标题分割级别、页眉页脚开关、主题与字体管理（X 图卡同款） |
| **分发设置** | 微信公众号 | 默认账号、账号列表（点击编辑 / 测试连接，右上角「+」添加，行尾删除）、API 代理地址与测试代理（见 [API 代理设置](./api-proxy.md)） |
| | 飞书 | 飞书自建应用、目标文件夹、OpenAPI 调用统计 |
| | 其他平台 | 浏览器插件「多栖 Crosspost」连接、许可密钥 / 爱发电兑换 / 今日额度（见 [额度与许可](./quota-and-license.md)、[小红书图文发布](./rednote-publishing.md)） |
| **AI 设置** | AI Provider 与编排 | AI Provider 列表与默认 Provider、AI 编排（开关 / 模型质量 / 默认布局与颜色 / 超时 / 清空缓存）、标题 AI 润色（见 [AI Provider 设置](./ai-provider.md)） |

## 相关文档

- 代理服务端部署（自建 ECS）：[`../../server/README.md`](../../server/README.md)
