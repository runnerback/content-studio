import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';

const ROOT = process.cwd();

const SOURCE_FILES = {
  markdownIt: path.join(ROOT, 'lib', 'markdown-it.min.js'),
  highlight: path.join(ROOT, 'lib', 'highlight.min.js'),
};

async function ensureOrGenerateDeps() {
  // Ensure lib directory exists
  fs.mkdirSync(path.join(ROOT, 'lib'), { recursive: true });

  // 1. Copy markdown-it.min.js from node_modules
  const mdItSrc = path.join(ROOT, 'node_modules', 'markdown-it', 'dist', 'markdown-it.min.js');
  const mdItDest = SOURCE_FILES.markdownIt;
  if (!fs.existsSync(mdItSrc)) {
    throw new Error('markdown-it is not installed in node_modules. Run npm install first.');
  }
  const mdItContent = fs.readFileSync(mdItSrc, 'utf8');
  fs.writeFileSync(mdItDest, mdItContent, 'utf8');
  console.log('[generate-embedded-deps] Generated lib/markdown-it.min.js from node_modules');

  // 2. Bundle highlight.js/lib/common.js
  const hljsEntry = path.join(ROOT, 'node_modules', 'highlight.js', 'lib', 'common.js');
  const hljsDest = SOURCE_FILES.highlight;
  if (!fs.existsSync(hljsEntry)) {
    throw new Error('highlight.js is not installed in node_modules. Run npm install first.');
  }
  console.log('[generate-embedded-deps] Bundling highlight.js...');
  const hljsResult = await esbuild.build({
    entryPoints: [hljsEntry],
    bundle: true,
    minify: true,
    write: false,
    format: 'iife',
    globalName: 'hljs',
  });
  let hljsCode = hljsResult.outputFiles[0].text;
  // Append CommonJS compatibility export for tests
  hljsCode += '\nif (typeof module !== "undefined" && module.exports) { module.exports = hljs; }\n';
  fs.writeFileSync(hljsDest, hljsCode, 'utf8');
  console.log('[generate-embedded-deps] Generated lib/highlight.min.js via esbuild');

  // 3.12.0：公式改用 Obsidian 自带 MathJax（services/math-renderer.js），不再打包 mathjax-plugin.js
}

async function main() {
  // Generate the embedded lib bundles (lib/*.js) consumed by services/dependency-loader.js
  await ensureOrGenerateDeps();
}

main().catch(err => {
  console.error('[generate-embedded-deps] failed:', err);
  process.exit(1);
});

