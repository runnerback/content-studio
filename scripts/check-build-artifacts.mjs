import fs from "node:fs";
import { execFileSync } from "node:child_process";

const GENERATED_ARTIFACTS = [
  "main.js",
  "services/ai-layout-runtime/generated-skills.js",
];

function readArtifact(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
}

function buffersEqual(left, right) {
  if (left === null || right === null) return left === right;
  return left.equals(right);
}

const before = new Map(GENERATED_ARTIFACTS.map((filePath) => [filePath, readArtifact(filePath)]));

execFileSync("npm", ["run", "build"], { stdio: "inherit" });

// 构建前不存在的产物（如 CI 全新 checkout 里被 gitignore 的 main.js）是首次生成，不是漂移；只比对构建前已存在的。
const changed = GENERATED_ARTIFACTS.filter((filePath) => {
  const previous = before.get(filePath);
  if (previous === null) return false;
  const current = readArtifact(filePath);
  return !buffersEqual(previous, current);
});

if (changed.length > 0) {
  console.error("[check-build-artifacts] Build changed generated artifacts:");
  for (const filePath of changed) {
    console.error(`- ${filePath}`);
  }
  console.error("[check-build-artifacts] Commit the regenerated files, then rerun npm run check:build-artifacts.");
  process.exit(1);
}

console.log("[check-build-artifacts] Generated build artifacts are reproducible.");
