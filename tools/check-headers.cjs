#!/usr/bin/env node
/* ============================================================
   tools/check-headers.cjs — 校验 _headers 的路径匹配（本地，不联网）

   为什么需要它（2026-10-25）：
     首页重构后根 _headers 收紧了 CSP（去掉 'unsafe-inline'），内嵌项目副本仍然
     依赖内联脚本/样式，所以新增 projects/_headers 单独放开。这套「根严格 + 子目录放宽」
     的匹配关系在 Cloudflare Pages 上生效，但本地没有浏览器能直接看出来——
     一旦写错路径模式（例如写成 /projects/ 而不是 /projects/*，或者顺序反了），
     内嵌游戏会静默白屏。

     本脚本按 wrangler 的查询顺序（从深到浅，先规则先匹配）模拟 _headers，
     断言几个关键路径拿到的 CSP 是预期的那一条。

   用法：node tools/check-headers.cjs        # 通过 exit 0，失败 exit 1
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** 读取一个 _headers 文件成 { pattern, headers[] } 列表（保持文件顺序）。 */
function parseHeadersFile(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
  const rules = [];
  let current = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      // 路径模式行
      current = { pattern: line.trim(), headers: [] };
      rules.push(current);
    } else if (current) {
      const m = line.trim().match(/^([^:]+):\s*(.+)$/);
      if (m) current.headers.push([m[1].trim(), m[2].trim()]);
    }
  }
  return rules;
}

/** /projects/* 这类模式 → 是否匹配给定路径。仅支持尾部 * 与精确匹配（本项目只用到这两种）。 */
function matchesPattern(pattern, urlPath) {
  if (pattern.endsWith('/*')) return urlPath.startsWith(pattern.slice(0, -1));
  return urlPath === pattern;
}

/** 按 wrangler 的查询顺序收集路径上所有可能命中的规则（由深到浅）。 */
function rulesFor(urlPath) {
  const dirs = [];
  let dir = path.posix.dirname(urlPath);
  while (true) {
    dirs.push(dir === '/' ? '/' : dir + '/');
    if (dir === '/' || dir === '.') break;
    dir = path.posix.dirname(dir);
  }
  const hits = [];
  for (const d of dirs) {
    const file = d === '/' ? path.join(ROOT, '_headers') : path.join(ROOT, d.slice(1), '_headers');
    for (const rule of parseHeadersFile(file)) {
      if (matchesPattern(rule.pattern, urlPath)) hits.push(rule);
    }
  }
  return hits;
}

/** 取该路径实际生效的 CSP（先出现的规则先赢，与 Pages 行为一致）。 */
function cspFor(urlPath) {
  for (const rule of rulesFor(urlPath)) {
    const hit = rule.headers.find(([k]) => k.toLowerCase() === 'content-security-policy');
    if (hit) return hit[1];
  }
  return undefined;
}

const STRICT = "default-src 'self'; script-src 'self'; style-src 'self';";
const RELAXED = "script-src 'self' 'unsafe-inline'";

const CASES = [
  { path: '/', expect: 'strict', why: '首页不含内联脚本，必须用严格 CSP' },
  { path: '/css/tokens.css', expect: 'strict', why: '静态资源同样走根规则' },
  { path: '/projects/ping-pong-duel/', expect: 'relaxed', why: '内嵌乒乓用到内联脚本/样式' },
  { path: '/projects/delta-force/', expect: 'relaxed', why: '内嵌落幕查用到内联脚本/样式' },
  { path: '/projects/game-collection/games/ping-pong/', expect: 'relaxed', why: '合集内嵌乒乓同理' },
  { path: '/projects/space-kill/', expect: 'relaxed', why: '规则站内联样式' },
];

let failed = 0;
for (const c of CASES) {
  const csp = cspFor(c.path);
  const ok = csp !== undefined
    && (c.expect === 'strict' ? csp.includes(STRICT) && !csp.includes(RELAXED) : csp.includes(RELAXED));
  console.log(`  ${ok ? '✓' : '✗'} ${c.path.padEnd(48)} ${c.expect === 'strict' ? '严格' : '放宽'}  — ${c.why}`);
  if (!ok) {
    failed++;
    console.log(`      实际：${csp === undefined ? '(无 CSP)' : csp}`);
  }
}

console.log(failed ? `\n  ✗ ${failed} 条不符合预期\n` : '\n  ✓ _headers 匹配符合预期\n');
process.exitCode = failed ? 1 : 0;
