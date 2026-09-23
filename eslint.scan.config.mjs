// 本地复现社区目录扫描（obsidianmd recommended + typescript-eslint 类型感知规则），不进主配置
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
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
);
