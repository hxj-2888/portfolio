#!/usr/bin/env node
/* ============================================
   sync-projects.js — 子项目自动化同步器
   读取 sync.json，把各独立源仓库的产物同步进 projects/，
   并按配置自动打上 portfolio 内嵌适配补丁。

   特性：
     · 幂等 —— 补丁已应用则跳过，重复执行不会产生重复代码
     · 安全 —— 只复制 sync.json 显式列出的文件，neverCopy 清单会被校验拦截
     · 可预览 —— --dry-run 只打印不写盘
     · 可控 —— enabled=false 的项目直接跳过并打印原因（如本次屏蔽的 space-kill）

   用法： node sync-projects.js [--dry-run]
   ============================================ */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'sync.json');
const DRY_RUN = process.argv.includes('--dry-run');

// ==================== 日志 ====================
const C = {
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};
const log = (m) => console.log(`  ${C.cyan('→')} ${m}`);
const ok = (m) => console.log(`  ${C.green('✓')} ${m}`);
const warn = (m) => console.log(`  ${C.yellow('⚠')} ${m}`);
const fail = (m) => console.log(`  ${C.red('✗')} ${m}`);

// ==================== 工具 ====================
function readText(file) { return fs.readFileSync(file, 'utf-8'); }

function writeText(file, content) {
  if (DRY_RUN) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf-8');
}

function copyFile(src, dest) {
  if (DRY_RUN) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/** 单条补丁规则，返回 applied | skipped | missing */
function applyRule(content, rule) {
  if (rule.type === 'regex') {
    const re = new RegExp(rule.from, 'g');
    if (!re.test(content)) {
      if (rule.okIfContains && content.includes(rule.okIfContains)) return { state: 'skipped', content };
      return { state: 'missing', content };
    }
    re.lastIndex = 0;
    const next = content.replace(re, rule.to);
    return next === content ? { state: 'skipped', content } : { state: 'applied', content: next };
  }
  // 默认按字符串处理（替换全部出现位置）
  if (content.includes(rule.to)) return { state: 'skipped', content };
  if (!content.includes(rule.from)) {
    if (rule.okIfContains && content.includes(rule.okIfContains)) return { state: 'skipped', content };
    return { state: 'missing', content };
  }
  return { state: 'applied', content: content.split(rule.from).join(rule.to) };
}

/** 校验 neverCopy 清单里的文件没有被误列入 files */
function checkNeverCopy(project) {
  const banned = Object.keys(project.neverCopy || {}).filter((k) => !k.startsWith('_'));
  const violations = (project.files || []).filter((f) => typeof f === 'string' && banned.includes(f));
  violations.forEach((f) => fail(`${project.id}: 配置错误 —— ${f} 属于 neverCopy 禁复制清单：${project.neverCopy[f]}`));
  return violations.length === 0;
}

/** 极简 glob → RegExp：支持 **（任意层级）与 *（不含分隔符） */
function globToRegExp(glob) {
  const src = glob
    .replace(/\\/g, '/')
    .split('**')
    .map((part) => part.split('*').map((s) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
    .join('.*');
  return new RegExp('^' + src + '$');
}

/** 相对路径匹配：精确相等，或按 glob 规则匹配 */
function matchRel(rel, pattern) {
  if (rel === pattern) return true;
  if (!/[*?]/.test(pattern)) return false;
  return globToRegExp(pattern).test(rel);
}

/** 递归列出 baseAbs 下所有文件的相对路径（相对 baseAbs） */
function walkRel(baseAbs) {
  const out = [];
  const visit = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(abs, rel);
      else out.push(rel);
    }
  };
  visit(baseAbs, '');
  return out.sort();
}

/**
 * 把 project.files 展开成 [{ from, rel }]：
 *   from = 相对 sourceDir 的源路径；rel = 相对 targetDir 的目标路径
 */
function expandFileEntries(project) {
  const plan = [];
  for (const entry of project.files || []) {
    if (typeof entry === 'string') {
      plan.push({ from: entry, rel: entry });
      continue;
    }
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.files)) {
      throw new Error(`files 条目格式错误：${JSON.stringify(entry)}`);
    }
    const base = entry.base || '.';
    const to = entry.to || '.';
    const set = new Set();
    for (const pattern of entry.files) {
      if (!/[*?]/.test(pattern)) { set.add(pattern); continue; }
      const abs = path.join(ROOT, project.sourceDir, base);
      if (!fs.existsSync(abs)) throw new Error(`分组的 base 目录不存在：${base}`);
      const hits = walkRel(abs).filter((rel) => matchRel(rel, pattern));
      if (hits.length === 0) throw new Error(`通配未命中任何文件：${base}/${pattern}`);
      hits.forEach((rel) => set.add(rel));
    }
    for (const rel of [...set].sort()) {
      plan.push({
        from: path.posix.join(base, rel),
        rel: path.posix.join(to === '.' ? '' : to, rel),
      });
    }
  }
  return plan;
}

// ==================== 同步单个项目 ====================
function syncProject(project) {
  const srcRoot = path.resolve(ROOT, project.sourceDir);
  const dstRoot = path.resolve(ROOT, project.targetDir);

  if (!fs.existsSync(srcRoot)) {
    fail(`${project.id}: 源目录不存在 — ${srcRoot}`);
    return false;
  }

  log(`${project.id}: ${path.relative(ROOT, srcRoot)} → ${path.relative(ROOT, dstRoot)}`);

  let copied = 0, unchanged = 0, patched = 0, missing = 0;

  // ---- 0. 分组清单展开（向后兼容）----
  // files 既可写字符串（相对 sourceDir），也可写 { base, to, files } 分组：
  //   base 相对 sourceDir；to 相对 targetDir；files 支持 "dir/**" 递归与 "dir/*" 单层
  let plan;
  try {
    plan = expandFileEntries(project);
  } catch (err) {
    fail(`${project.id}: ${err.message}`);
    return false;
  }
  const banned = Object.keys(project.neverCopy || {}).filter((k) => !k.startsWith('_'));
  for (const item of plan) {
    if (banned.some((b) => matchRel(item.rel, b))) {
      fail(`${project.id}: 配置错误 —— ${item.rel} 命中 neverCopy 禁复制清单`);
      return false;
    }
  }

  // ---- 1. 复制文件 ----
  for (const item of plan) {
    const src = path.join(srcRoot, item.from);
    const dst = path.join(dstRoot, item.rel);

    if (!fs.existsSync(src)) {
      fail(`${project.id}: 源文件缺失 — ${item.from}`);
      return false;
    }

    const srcBuf = fs.readFileSync(src);
    const same = fs.existsSync(dst) && fs.readFileSync(dst).equals(srcBuf);
    copyFile(src, dst);
    if (same) unchanged++; else { copied++; log(`  更新 ${item.rel}`); }
  }

  // ---- 2. 应用内嵌适配补丁 ----
  for (const patch of project.patches || []) {
    const target = path.join(dstRoot, patch.file);
    if (!fs.existsSync(target)) {
      fail(`${project.id}: 补丁目标不存在 — ${patch.file}`);
      return false;
    }
    let content = readText(target);
    let changed = false;

    for (const rule of patch.rules || []) {
      const res = applyRule(content, rule);
      content = res.content;
      if (res.state === 'applied') { changed = true; patched++; log(`  补丁 ${patch.file} ← ${rule.type === 'regex' ? rule.from : rule.from.slice(0, 42)}`); }
      if (res.state === 'missing') { missing++; warn(`  补丁未匹配（请人工检查）${patch.file} ← ${rule.from.slice(0, 60)}`); }
    }

    if (changed) {
      writeText(target, content);
      ok(`  已写入补丁：${patch.file}${patch.note ? ' — ' + patch.note : ''}`);
    }
  }

  const parts = [];
  if (copied) parts.push(`更新 ${copied}`);
  if (unchanged) parts.push(`无变化 ${unchanged}`);
  if (patched) parts.push(`补丁 ${patched}`);
  if (missing) parts.push(`未匹配 ${missing}`);
  ok(`${project.id}: ${parts.join(' / ') || '无操作'}`);
  return true;
}

// ==================== 主流程 ====================
function main() {
  console.log('\n🔄 作品集项目同步器' + (DRY_RUN ? C.yellow('（DRY RUN — 不写入磁盘）') : '') + '\n');
  console.log(`  配置: ${CONFIG_PATH}\n`);

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('❌ 找不到 sync.json 配置文件');
    process.exit(1);
  }

  const config = JSON.parse(readText(CONFIG_PATH));
  const projects = config.projects || [];

  let success = 0, failed = 0, skipped = 0;

  for (const project of projects) {
    console.log(`\n━━━ ${project.id} ━━━`);

    if (project.enabled !== true) {
      warn(`已跳过（enabled=false）${project.reason ? ' — ' + project.reason : ''}`);
      skipped++;
      continue;
    }

    if (!checkNeverCopy(project)) { failed++; continue; }

    try {
      if (syncProject(project)) success++; else failed++;
    } catch (err) {
      fail(`${project.id}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '━'.repeat(40));
  console.log(`\n  ✅ 同步: ${success}  |  ⏭ 跳过: ${skipped}  |  ❌ 失败: ${failed}\n`);

  if (failed > 0) process.exit(1);
}

main();
