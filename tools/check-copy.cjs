#!/usr/bin/env node
/* ============================================================
   check-copy.cjs — 文案守门：禁止无法验证的自我评价与旧名称
   规则来源：docs/作品集重构方案.md §7
   用法：node tools/check-copy.cjs
   退出码：0 通过；1 命中违禁词
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  'index.html',
  'projects.json',
  'projects/game-collection/index.html',
  'js/site.js',
];

// 违禁词：不可验证的评价/数据 + 作品集里不该出现的旧展示名
const BANNED = [
  { re: /4\.8\s*\/\s*5/, why: '无法验证的评分' },
  { re: /合作满意评分/, why: '无法验证的评价' },
  { re: /\d+\s*年(产品)?设计经验/, why: '无法验证的年限（用可核对的事实替代）' },
  { re: /服务行业领域/, why: '无法验证的行业数量' },
  { re: /为复杂问题，设计清晰体验/, why: '旧文案（已由“做能玩的网页作品”替代）' },
  { re: /太空杀/, why: '旧展示名，统一为「返航录」' },
];

const hits = [];
for (const rel of TARGETS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { console.log(`  ⚠ 跳过（文件不存在）：${rel}`); continue; }
  const text = fs.readFileSync(abs, 'utf-8');
  text.split('\n').forEach((line, i) => {
    for (const b of BANNED) {
      if (b.re.test(line)) hits.push(`${rel}:${i + 1}  「${b.why}」 → ${line.trim().slice(0, 80)}`);
    }
  });
}

if (hits.length) {
  console.log('\n✗ 文案守门未通过：');
  hits.forEach((h) => console.log('  ' + h));
  process.exit(1);
}
console.log(`\n✓ 文案守门通过：${TARGETS.length} 个文件、${BANNED.length} 条规则，0 命中`);
