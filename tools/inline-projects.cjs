#!/usr/bin/env node
/* ============================================================
   tools/inline-projects.cjs — 把 projects.json 写进首页内联块

   为什么不用 fetch：
     作品区完全由 projects.json 渲染。此前页面在加载后再发一次 fetch，
     链路抖一下（超时、截断、边缘节点回退成 index.html）整块作品就空白。
     现在数据随首页一起下发，页面只需要这一次 HTML 请求；fetch 只保留为
     「内联块缺失」时的兜底。

   真源仍是 projects.json：本脚本只做机械复制，不改字段、不猜内容。
     node tools/inline-projects.cjs           # 写入
     node tools/inline-projects.cjs --check   # 只校验（门禁用）

   输出位置：index.html 里 id="projects-data" 的 JSON script。
   JSON 里的 "<" 统一转成 \u003c，避免任何 </script> 提前闭合。
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const DATA = path.join(ROOT, 'projects.json');
const CHECK = process.argv.includes('--check');
const RE = /(<script type="application\/json" id="projects-data">)([\s\S]*?)(<\/script>)/;

function build() {
  const raw = fs.readFileSync(DATA, 'utf8');
  const data = JSON.parse(raw);
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const html = fs.readFileSync(INDEX, 'utf8');
  const matches = html.match(new RegExp(RE.source, 'g')) || [];
  if (matches.length !== 1) {
    throw new Error(`index.html 里应恰有 1 个 #projects-data 内联块，实际 ${matches.length} 个`);
  }
  const next = html.replace(RE, `$1${json}$3`);
  return { next, html, count: (data.projects || []).length, bytes: Buffer.byteLength(json, 'utf8') };
}

try {
  const { next, html, count, bytes } = build();
  if (CHECK) {
    if (next !== html) {
      console.log(`  ✗ 内联数据与 projects.json 不一致（${count} 条项目 / ${bytes} 字节）`);
      console.log('    → 运行 node tools/inline-projects.cjs 后重新提交');
      process.exit(1);
    }
    console.log(`  ✓ 内联数据与 projects.json 一致（${count} 条项目 / ${bytes} 字节）`);
  } else {
    fs.writeFileSync(INDEX, next);
    console.log(`  ✓ 已写入内联数据（${count} 条项目 / ${bytes} 字节）`);
  }
} catch (err) {
  console.log(`  ✗ ${err.message}`);
  process.exit(1);
}
