// generated-skills.js 的类型声明。该 .js 由 npm run build（scripts/build-ai-layout-runtime.mjs）生成且已 gitignore，
// 仓库快照 / CI / 目录站扫描里没有它；有了这份声明，import './generated-skills.js' 在任何环境都解析到同一类型，
// 不会退化成 error type（TS 对 ./x.js 的解析顺序是 x.ts → x.d.ts → x.js）。esbuild 打包仍用真实的 .js。
import type { AiLayoutSharedResources, AiLayoutSkill } from './registry.js';

declare const generatedSkills: {
  shared: AiLayoutSharedResources;
  skills: AiLayoutSkill[];
};
export default generatedSkills;
