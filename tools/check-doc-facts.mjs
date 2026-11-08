#!/usr/bin/env node
/* ============================================================
   check-doc-facts.mjs — 文档「事实契约」校验（两仓同源代码）

   解决的是 check-docs-fresh 管不到的问题：文档写了、日期也对，
   但里面的数字 / TTL / 端点清单和代码不一致。

   契约写在同目录 doc-facts.mjs，引擎只读不猜：
     facts[] —— 单点事实：从代码/JSON/命令取真值，去文档里比对捕获组
     sets[]  —— 集合事实：代码侧集合 vs 文档侧集合，双向差集都要为空

   用法：
     node tools/check-doc-facts.mjs            # 静态事实（毫秒级，pre-push 用）
     node tools/check-doc-facts.mjs --full     # 额外跑命令类事实（CI 用）
     node tools/check-doc-facts.mjs --quiet    # 只输出失败项
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { facts, sets } from './doc-facts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FULL = process.argv.includes('--full');
const QUIET = process.argv.includes('--quiet');
const SKIP = Symbol('skip');

let failures = 0;
let skipped = 0;
const ok = (m) => { if (!QUIET) console.log(`  ✓ ${m}`); };
const fail = (m) => { console.log(`  ✗ ${m}`); failures++; };
const warn = (m) => { if (!QUIET) console.log(`  ⚠ ${m}`); };

const abs = (rel) => path.join(ROOT, rel);
const read = (rel) => fs.readFileSync(abs(rel), 'utf8');
const re = (src, flags = '') => new RegExp(src, flags);
const asNum = (v) => {
  if (v === null || v === undefined || typeof v === 'symbol') return null;
  const n = Number(String(v).replace(/[,％%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/* ---------- 1. 单点事实提取 ---------- */
function factValue(from) {
  switch (from.kind) {
    case 'jsonPath': {
      let v = JSON.parse(read(from.file));
      for (const p of from.path.split('.')) {
        if (v == null) return null;
        v = v[p];
      }
      return v;
    }
    case 'countLines': {
      const has = re(from.match);
      const excl = from.exclude ? re(from.exclude) : null;
      return read(from.file).split(/\r?\n/)
        .filter((l) => has.test(l) && !(excl && excl.test(l))).length;
    }
    case 'capture': {
      const m = read(from.file).match(re(from.pattern, from.flags || ''));
      return m ? m[from.group ?? 1] : null;
    }
    case 'countInCapture': {
      const m = read(from.file).match(re(from.pattern, from.flags || ''));
      if (!m) return null;
      return (m[from.group ?? 1].match(re(from.count, 'g')) || []).length;
    }
    case 'command': {
      if (!FULL) return SKIP;
      let out;
      try {
        out = execFileSync(from.cmd[0], from.cmd.slice(1), {
          cwd: ROOT, encoding: 'utf8', timeout: from.timeout || 180000,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (e) {
        if (from.onError === 'warn') {
          warn(`${from.cmd.join(' ')} 在本环境跑不起来，跳过该事实：${e.message.split('\n')[0]}`);
          return SKIP;
        }
        throw e;
      }
      const m = String(out).match(re(from.pattern, from.flags || ''));
      return m ? m[from.group ?? 1] : null;
    }
    default:
      throw new Error(`未知 from.kind: ${from.kind}`);
  }
}

if (!QUIET) console.log('── 单点事实 ──────────────────────────────');
for (const f of facts) {
  let raw;
  try {
    raw = factValue(f.from);
  } catch (e) {
    fail(`${f.id}: 事实提取报错 —— ${e.message.split('\n')[0]}`);
    continue;
  }
  if (raw === SKIP) { skipped++; continue; }

  let value = asNum(raw);
  if (value !== null && f.from.scale) value = value * f.from.scale;
  if (value === null) {
    fail(`${f.id}: 提取不到真值（检查 doc-facts.mjs 里的正则/路径）`);
    continue;
  }

  for (const e of f.expect) {
    const file = abs(e.doc);
    if (!fs.existsSync(file)) { fail(`${f.id}: 文档不存在 ${e.doc}`); continue; }
    const m = read(e.doc).match(re(e.pattern, e.flags || ''));
    if (!m) { fail(`${f.id}: ${e.doc} 里找不到「${e.label || e.pattern}」`); continue; }
    const docVal = asNum(m[e.group ?? 1]);
    if (docVal !== value) {
      fail(`${f.id}: 代码真值 ${value}，${e.doc} 写的是 ${docVal}` +
           `${e.hint ? `\n      → ${e.hint}` : ''}`);
    } else {
      ok(`${f.id}: ${value} = ${e.doc}「${e.label || m[0].trim()}」`);
    }
  }
}

/* ---------- 2. 集合事实提取 ---------- */
function extractSet(spec) {
  const out = new Set();
  if (spec.dir) {
    const base = abs(spec.dir);
    const want = re(spec.filePattern);
    const walk = (dir, prefix) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const rel = prefix ? `${prefix}/${name}` : name;
        if (fs.statSync(full).isDirectory()) walk(full, rel);
        else if (want.test(rel)) out.add(rel);
      }
    };
    if (fs.existsSync(base)) walk(base, '');
    return out;
  }

  let txt = read(spec.file);
  for (const [a, b] of spec.preReplace || []) txt = txt.replace(re(a, 'g'), b);
  const rx = re(spec.pattern, 'g');
  let m;
  while ((m = rx.exec(txt)) !== null) {
    let s = m[spec.group ?? 0];
    if (typeof s !== 'string') continue;
    for (const [a, b] of spec.normalize || []) s = s.replace(re(a, 'g'), b);
    if ((spec.exclude || []).some((x) => re(x).test(s))) continue;
    if (s) out.add(s);
  }
  return out;
}

if (sets.length && !QUIET) console.log('── 集合事实 ──────────────────────────────');
for (const s of sets) {
  let code, doc;
  try {
    code = extractSet(s.code);
    doc = extractSet(s.doc);
  } catch (e) {
    fail(`${s.id}: 集合提取报错 —— ${e.message.split('\n')[0]}`);
    continue;
  }
  const docOnly = [...doc].filter((x) => !code.has(x) && !(s.ignoreDocOnly || []).includes(x)).sort();
  const codeOnly = [...code].filter((x) => !doc.has(x) && !(s.ignoreCodeOnly || []).includes(x)).sort();

  if (docOnly.length) {
    fail(`${s.id}: ${s.docLabel || '文档'} 写了、${s.codeLabel || '代码'} 里没有 → ${docOnly.join('、')}` +
         `${s.docOnlyHint ? `\n      → ${s.docOnlyHint}` : ''}`);
  }
  if (codeOnly.length) {
    fail(`${s.id}: ${s.codeLabel || '代码'} 有、${s.docLabel || '文档'} 没写 → ${codeOnly.join('、')}` +
         `${s.codeOnlyHint ? `\n      → ${s.codeOnlyHint}` : ''}`);
  }
  if (!docOnly.length && !codeOnly.length) {
    ok(`${s.id}: ${code.size} 项双向一致（${s.codeLabel || '代码'} ↔ ${s.docLabel || '文档'}）`);
  }
}

/* ---------- 3. 结论 ---------- */
console.log('');
if (skipped) warn(`${skipped} 项命令类事实未跑（加 --full 启用，CI 会自动跑）`);
if (failures) {
  console.log(`❌ 事实契约未通过：${failures} 项。契约见 tools/doc-facts.mjs，别改代码去迁就文档。`);
  process.exit(1);
} else if (!QUIET) {
  console.log('✓ 事实契约通过：文档里的数字、TTL、端点清单、索引均与实际代码一致');
}
