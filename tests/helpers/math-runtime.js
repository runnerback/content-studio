// tests/helpers/math-runtime.js
//
// 3.12.0 起公式不再打包 MathJax：把仓库自己的 markdown-it 公式插件挂到 window.ObsidianWechatMath，
// 渲染由 __mocks__/obsidian.js 的 renderMath 产出 CHTML 形态的 <mjx-container>。
// 用 import() 而不是 require()：服务模块是 ESM，且要经 vitest 的 obsidian 别名加载，与其它 import 共用同一实例。
// 用法（替代旧的 require('../lib/mathjax-plugin.js')）：await require('./helpers/math-runtime.js').installTestMathPlugin();

async function installTestMathPlugin() {
  if (typeof window === 'undefined') {
    global.window = global;
  }
  // services/obsidian-adapters.js 在 Obsidian 里用模块级 require 拿 'obsidian'；测试里退回 window.require
  //（与 tests/helpers/input-module.cjs 同一做法），经 obsidian-resolver 指到 __mocks__/obsidian.js
  if (typeof window.require !== 'function') {
    window.require = require;
  }
  if (typeof window.ObsidianWechatMath !== 'function') {
    const { markdownItMath } = await import('../../services/markdown-it-math.js');
    window.ObsidianWechatMath = markdownItMath;
  }
  return window.ObsidianWechatMath;
}

module.exports = { installTestMathPlugin };
