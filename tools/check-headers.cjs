#!/usr/bin/env node
/* ============================================================
   tools/check-headers.cjs — 校验 _headers 的 CSP 结构（本地，不联网）

   背景（2026-10-25）：
     首页重构后收紧 CSP（去掉 'unsafe-inline'），但内嵌项目副本仍依赖内联脚本/样式。
     先试过「根严格 + projects/_headers 放宽」，线上实测**没有生效**——Pages 的路径
     递减规则没按预期合并，/projects/ 下拿到的仍是根的严格策略，游戏页会白屏。

     现在改为在根 _headers 里把 CSP 写两行：HTTP 允许多个同名响应头，CSP 按规范
     取交集，浏览器执行更宽松的那条（'self' 是 'unsafe-inline' 的子集）。
     这条约束靠肉眼很难验证，所以用本脚本守住它。

   断言：
     1. 根 _headers 恰好有两条 Content-Security-Policy；
     2. 第一条是严格版（不含 unsafe-inline），第二条是宽松版（含 unsafe-inline）；
     3. 不存在 projects/_headers（存在就意味着回到那条未生效的路子上）；
     4. 首页 HTML 里没有内联 onclick / 内联 <script> / 内联 style 属性。

   用法：node tools/check-headers.cjs
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failed = 0;
const fail = (msg) => { console.log(`  ✗ ${msg}`); failed++; };
const pass = (msg) => console.log(`  ✓ ${msg}`);

/** 读取 _headers 里某条指令的所有取值（保持文件顺序）。 */
function directiveValues(file, name) {
  if (!fs.existsSync(file)) return [];
  const values = [];
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z-]+):\s*(.+)$/);
    if (m && m[1].toLowerCase() === name.toLowerCase()) values.push(m[2].trim());
  }
  return values;
}

const root = path.join(ROOT, '_headers');
const csp = directiveValues(root, 'content-security-policy');

if (csp.length === 2) pass('_headers 有两条 Content-Security-Policy');
else fail(`_headers 应有 2 条 Content-Security-Policy，实际 ${csp.length} 条`);

if (csp.length >= 1) {
  if (!csp[0].includes('unsafe-inline')) pass('第一条是严格版（不含 unsafe-inline）');
  else fail('第一条必须是不含 unsafe-inline 的严格版');
}
if (csp.length >= 2) {
  if (csp[1].includes("script-src 'self' 'unsafe-inline'")) pass('第二条是宽松版（script-src 含 unsafe-inline）');
  else fail('第二条必须是含 script-src \'self\' \'unsafe-inline\' 的宽松版');
}

const projectsHeaders = path.join(ROOT, 'projects', '_headers');
if (!fs.existsSync(projectsHeaders)) pass('没有 projects/_headers（递减规则不可用，已删除）');
else fail('projects/_headers 存在但线上不生效，应删除（改用根 _headers 的双 CSP）');

// 首页不得引入内联脚本 / 内联样式，否则严格版 CSP 会把它打掉
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
const inlineAttr = (index.match(/\son\w+="/g) || []).length;
const inlineStyle = (index.match(/\sstyle="/g) || []).length;
const inlineScript = (index.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || []).filter((s) => !s.includes('application/ld+json')).length;

if (inlineAttr === 0) pass('首页无内联事件属性'); else fail(`首页有 ${inlineAttr} 处内联事件属性`);
if (inlineStyle === 0) pass('首页无内联 style 属性'); else fail(`首页有 ${inlineStyle} 处内联 style 属性`);
if (inlineScript === 0) pass('首页无内联 <script>（JSON-LD 不算）'); else fail(`首页有 ${inlineScript} 处内联 <script>`);

console.log(failed ? `\n  ✗ ${failed} 项不符合预期\n` : '\n  ✓ _headers 结构符合预期\n');
process.exitCode = failed ? 1 : 0;
