#!/usr/bin/env node
/* 作品集 · 3D 版本卡自动同步（只改 returnlog 条目里「3D 版」那一条的三个字段）。
 *
 * 为什么需要：projects.json 是作品集唯一数据源，3D 版的 proof / proofUrl 一直手写，
 * 2026-11-12 已出现两处失真 —— proofUrl 还指向已废弃的 v1-preview 分支，
 * desc 还写着「只有本机工程」（实际已推到 returnlog 的 3d 副分支）。
 *
 * 做法：从 returnlog@3d 的 version.json + spec/gameplay-parity.json 读事实，
 * **只做字符串级字段替换**（不整体 JSON.stringify，否则会把作者手写的紧凑排版
 * 全部展开成 200+ 行噪音 diff）。其余内容与格式原样保留。
 *
 * 用法：
 *   node tools/sync-3d-card.js --source upstream-3d
 *   node tools/sync-3d-card.js --source "../新返航录 3D 版"
 *   node tools/sync-3d-card.js --dry-run
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const srcIdx = argv.indexOf('--source');
const SOURCE = path.resolve(ROOT, srcIdx >= 0 ? argv[srcIdx + 1] : 'upstream-3d');
const REPO_URL = 'https://github.com/hxj-2888/returnlog';
const BRANCH = '3d';

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const versionPath = path.join(SOURCE, '3d/version.json');
const parityPath = path.join(SOURCE, '3d/spec/gameplay-parity.json');
if (!fs.existsSync(versionPath) || !fs.existsSync(parityPath)) {
  console.error('[sync-3d] 找不到 3D 事实源：' + SOURCE);
  console.error('           需要 3d/version.json 与 3d/spec/gameplay-parity.json');
  process.exit(1);
}

const version = readJson(versionPath);
const parity = readJson(parityPath);
const entries = Array.isArray(parity.entries) ? parity.entries : [];
const budget = parity.budget || {};
const pending = Number(budget.pending ?? entries.filter((e) => e.status === 'pending').length);

const next = {
  proof: [version.version || 'V1P', entries.length + ' 函数', '未映射 ' + pending].join(' · '),
  proofUrl: REPO_URL + '/tree/' + BRANCH + '/3d/spec/gameplay-parity.json',
  desc: 'Godot 4.6 垂直切片，与 2.5D 共用规则口径，只搬数据与判定、不搬玩法实现。'
    + '工程在 returnlog 的 ' + BRANCH + ' 副分支，暂无网页产物（需 Godot Web 导出）。',
};

const projectsPath = path.join(ROOT, 'projects.json');
const text = fs.readFileSync(projectsPath, 'utf8');

/* 定位「3D 版」对象块：从 name 字段往前找最近的 {，再按括号配对找到结束 }。
 * 字符串里的 {} 要跳过，否则 desc 里的括号会把配对算错。 */
const nameAt = text.indexOf('"name": "3D 版"');
if (nameAt < 0) {
  console.error('[sync-3d] projects.json 里找不到 "name": "3D 版"');
  process.exit(1);
}
let start = text.lastIndexOf('{', nameAt);
if (start < 0) {
  console.error('[sync-3d] 找不到 3D 版对象起点');
  process.exit(1);
}
let depth = 0;
let end = -1;
let inStr = false;
for (let i = start; i < text.length; i++) {
  const c = text[i];
  if (inStr) {
    if (c === '\\') i++;
    else if (c === '"') inStr = false;
    continue;
  }
  if (c === '"') inStr = true;
  else if (c === '{') depth++;
  else if (c === '}') {
    depth--;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }
}
if (end < 0) {
  console.error('[sync-3d] 3D 版对象块括号不配对');
  process.exit(1);
}

let block = text.slice(start, end);
const before = {};
const changed = [];
for (const key of Object.keys(next)) {
  const re = new RegExp('("' + key + '"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"');
  const m = block.match(re);
  if (!m) {
    console.error('[sync-3d] 3D 版块里找不到字段 ' + key);
    process.exit(1);
  }
  before[key] = JSON.parse(m[0].slice(m[1].length));
  if (before[key] !== next[key]) {
    block = block.replace(re, m[1] + JSON.stringify(next[key]));
    changed.push(key);
  }
}

console.log('[sync-3d] 事实源 ' + SOURCE);
for (const key of Object.keys(next)) {
  const flag = changed.includes(key) ? '→ ' + JSON.stringify(next[key]) : '无变化';
  console.log('[sync-3d] ' + key.padEnd(9) + JSON.stringify(before[key]) + ' ' + flag);
}
if (!changed.length) {
  console.log('[sync-3d] 无变化，不写文件');
  process.exit(0);
}
if (DRY) {
  console.log('[sync-3d] --dry-run：不写 projects.json');
  process.exit(0);
}
fs.writeFileSync(projectsPath, text.slice(0, start) + block + text.slice(end), 'utf8');
console.log('[sync-3d] 已写 projects.json（仅 ' + changed.join(' / ') + '）');
