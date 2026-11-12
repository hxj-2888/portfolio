#!/usr/bin/env node
/* ============================================================
   tools/check-headers.cjs — 校验 _headers 的 CSP 结构与首页内联约束

   2026-11-12 修正：
     旧版把严格/宽松两条 CSP 写成同名两行，指望浏览器「执行更宽松的那条」。
     实测（Cloudflare Pages）同名头会被合并成一条逗号分隔策略，按 CSP 规范
     每条策略都要满足 → 严格那条生效，/projects/* 的内联脚本/样式全被拦。
     现在改为：
       /*          严格 CSP（首页与静态资源）
       /projects/* 用 "! Content-Security-Policy" 先删掉继承的严格策略，
                   再设置宽松策略（支持内联脚本/样式）。
     依据：Pages _headers 支持 "! Header-Name" 删除继承头；同名头合并规则见官方文档。

   断言：
     1. /* 只有一条 CSP，且不含 unsafe-inline；
     2. /projects/* 同时有 "! Content-Security-Policy" 与含 unsafe-inline 的 CSP；
     3. 不存在 projects/_headers；
     4. 首页 HTML 无内联事件属性 / 内联 style 属性 / 未登记的内联 <script>；
        允许 JSON-LD 与 id=projects-data 的 JSON 数据块。

   用法：node tools/check-headers.cjs
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failed = 0;
const fail = (msg) => { console.log(`  ✗ ${msg}`); failed++; };
const pass = (msg) => console.log(`  ✓ ${msg}`);

function parseBlocks(file) {
  const blocks = {};
  let current = null;
  for (const line of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^\s/.test(line)) {
      if (!current) continue;
      const unset = line.match(/^\s*!\s*([A-Za-z-]+)\s*$/);
      if (unset) { current.unset.push(unset[1].toLowerCase()); continue; }
      const m = line.match(/^\s*([A-Za-z-]+):\s*(.+)$/);
      if (m) current.headers.push({ name: m[1].toLowerCase(), value: m[2].trim() });
    } else {
      current = { path: line.trim(), headers: [], unset: [] };
      blocks[current.path] = current;
    }
  }
  return blocks;
}

const rootHeaders = path.join(ROOT, '_headers');
const blocks = parseBlocks(rootHeaders);
const root = blocks['/*'];
const proj = blocks['/projects/*'];

if (!root) fail('_headers 缺少 /* 规则');
else {
  const csp = root.headers.filter((h) => h.name === 'content-security-policy');
  if (csp.length === 1) pass('/* 只有一条 Content-Security-Policy');
  else fail(`/* 应有 1 条 Content-Security-Policy，实际 ${csp.length} 条`);
  if (csp.length === 1 && !csp[0].value.includes('unsafe-inline')) pass('/* 是严格版（不含 unsafe-inline）');
  else fail('/* 必须是严格版（不含 unsafe-inline）');
}

if (!proj) fail('_headers 缺少 /projects/* 规则');
else {
  if (proj.unset.includes('content-security-policy')) pass('/projects/* 先删除继承的 CSP');
  else fail('/projects/* 缺少 ! Content-Security-Policy（继承的严格策略会覆盖宽松策略）');
  const csp = proj.headers.filter((h) => h.name === 'content-security-policy');
  if (csp.length === 1) pass('/projects/* 有一条自己的 CSP');
  else fail(`/projects/* 应有 1 条 Content-Security-Policy，实际 ${csp.length} 条`);
  if (csp.length === 1 && csp[0].value.includes("script-src 'self' 'unsafe-inline'")) {
    pass('/projects/* 的 CSP 允许内联脚本');
  } else {
    fail('/projects/* 的 CSP 必须包含 script-src \'self\' \'unsafe-inline\'');
  }
  if (csp.length === 1 && csp[0].value.includes("style-src 'self' 'unsafe-inline'")) {
    pass('/projects/* 的 CSP 允许内联样式');
  } else {
    fail('/projects/* 的 CSP 必须包含 style-src \'self\' \'unsafe-inline\'');
  }
}

const projectsHeaders = path.join(ROOT, 'projects', '_headers');
if (!fs.existsSync(projectsHeaders)) pass('没有 projects/_headers（改用 /projects/* 规则）');
else fail('projects/_headers 存在，Pages 不支持按目录覆盖根 CSP，应删除');

// 首页不得引入内联脚本 / 内联样式，否则严格版 CSP 会把它打掉
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
const inlineAttr = (index.match(/\son\w+="/g) || []).length;
const inlineStyle = (index.match(/\sstyle="/g) || []).length;
const inlineScript = (index.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || [])
  .filter((s) => !s.includes('application/ld+json'))
  .filter((s) => !(s.includes('type="application/json"') && s.includes('id="projects-data"')));

if (inlineAttr === 0) pass('首页无内联事件属性'); else fail(`首页有 ${inlineAttr} 处内联事件属性`);
if (inlineStyle === 0) pass('首页无内联 style 属性'); else fail(`首页有 ${inlineStyle} 处内联 style 属性`);
if (inlineScript.length === 0) pass('首页无未登记的内联 <script>'); else fail(`首页有 ${inlineScript.length} 处未登记的内联 <script>`);

console.log(failed ? `\n  ✗ ${failed} 项不符合预期\n` : '\n  ✓ _headers 结构符合预期\n');
process.exitCode = failed ? 1 : 0;
