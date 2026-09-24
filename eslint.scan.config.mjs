// 本地复现社区目录扫描（obsidianmd recommended + typescript-eslint 类型感知规则），不进主配置。
// 运行方式：npm run scan:directory（带 --no-inline-config，代码里的行内规则开关一律不算数）
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
export default tseslint.config(
  { ignores: ["node_modules/**", "main.js", "lib/**", "styles.css", "tests/**", "__mocks__/**", "scripts/**", "docs/**", "*.mjs", "*.cjs", "coverage/**", "server/**", "ai-layout-skill/**", "eslint.config.js"] },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.js", "**/*.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      // tsconfig.scan.json = tsconfig.json + "types": []：目录站/CI 的扫描环境没有 @types/node，本地必须同样不吃它
      parserOptions: { project: "./tsconfig.scan.json", tsconfigRootDir: import.meta.dirname },
    },
  },
);
