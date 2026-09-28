# 贡献指南

> 版本 v1.1 ｜ 更新时间 2026-09-28（项目名改为 Note Content Studio；提交前统一跑 `npm run review:guard`）

感谢你愿意帮助改进 Note Content Studio。

## 开发准备

```bash
npm install --legacy-peer-deps
npm run build
npm test -- --run
```

改完代码后本地安装到 vault 验证：`bash dev-install.sh`（安装目录由 `.vault-path.local` 固定）。

## 提交变更前

请尽量保持变更范围清晰，并在提交前运行：

```bash
npm run review:guard   # lint + 风险模式扫描 + 目录扫描（scan:directory 必须 0 problems）+ 单测 + 打包 + 校验
```

规则（详见 `CLAUDE.md`）：不加 `eslint-disable` / `@ts-ignore` / `any`；界面文案进 `services/locales/{zh-cn,en}/*.js`，两套 key 必须一致；`styles.css`、`types/view-mixins.d.ts`、`services/ai-layout-runtime/` 是生成物，改源后重新生成。

如果只修改文档，可以说明未运行完整测试的原因。

## Issue 与 Pull Request

- 报告问题时，请附上 Obsidian 版本、插件版本、操作系统、复现步骤和必要截图。
- 涉及微信公众号 API 的问题，请不要公开提交 AppID、AppSecret、access token 或草稿内容。
- 涉及多平台发布的问题，请说明浏览器扩展版本、目标平台、连接状态和错误提示。
- Pull Request 应尽量小步提交，避免同时修改无关功能。

## 兼容性原则

- 不破坏现有公众号排版、复制、同步草稿箱流程。
- 不破坏多平台发布的「选择平台 → 发送到浏览器扩展」流程与桥接协议（改协议需先做兼容性评审）。
- 涉及样式修改时，需要手动检查设置页、预览区（含悬浮层高级选项）、发布弹窗和扩展设置页。
- 涉及网络、剪贴板或文件访问时，需要同步更新 README 的网络访问与隐私说明。
