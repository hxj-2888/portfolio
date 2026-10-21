#!/usr/bin/env node
/* ============================================================
   gen-rules-map.cjs — 由规则正文 md 生成条款清单 docs/data/rules-map.json
   规则正文 md 是「正文 → 站点」链路的中间产物（由 attachment-site/tools/pdf_to_md.py 从权威 PDF 抽取）。
   本脚本只做「条款编号 → 标题 → 测试锚点占位」的登记，不做任何改写。

   用法：node tools/gen-rules-map.cjs [--md <路径>] [--pdf <路径>] [--check]
     --md     规则正文 md，默认 ../../../太空杀游戏-完整版/attachment-site/规则正文/返航录正文v1preview1.0_规则.md
     --pdf    权威 PDF，默认同目录同名 pdf
     --check  只校验已有 rules-map.json 与 md 是否一致（不写盘）
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'data', 'rules-map.json');
const DEFAULT_MD = path.resolve(ROOT, '..', '太空杀游戏-完整版', 'attachment-site', '规则正文', '返航录正文v1preview1.0_规则.md');
const DEFAULT_PDF = path.join(path.dirname(DEFAULT_MD), '返航录三阵营对抗规则·正文v1preview1.0.pdf');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? path.resolve(args[i + 1]) : def;
};
const MD = opt('--md', DEFAULT_MD);
const PDF = opt('--pdf', DEFAULT_PDF);
const CHECK = args.includes('--check');

const sha16 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);

/* 条款标题行：#### 2.8.15 自指原则 / ### 一、… / ## 第X章 … */
function parseClauses(text) {
  const map = new Map();
  const numbered = /^#{2,4}\s+(\d+(?:\.\d+)+)(?:\s+(.{0,80}?))?\s*$/;
  const chapters = /^##\s+(第[0-9一二三四五六七八九十百零两]+[章节篇部回].*?)\s*$/;
  text.split('\n').forEach((line) => {
    let m = line.match(numbered);
    if (m) {
      const id = m[1];
      const title = (m[2] || '').trim();
      const prev = map.get(id);
      // 同号重复（正文里偶见小节锚点复用），保留第一次出现的非空标题
      if (!prev || (!prev.title && title)) map.set(id, { title, firstSeenAt: map.size });
      return;
    }
    m = line.match(chapters);
    if (m) {
      const id = m[1].split(/[（(]/)[0].trim();
      if (!map.has(id)) map.set(id, { title: m[1].trim(), firstSeenAt: map.size, chapter: true });
    }
  });
  return map;
}

function main() {
  for (const [label, p] of [['规则正文 md', MD], ['权威 PDF', PDF]]) {
    if (!fs.existsSync(p)) {
      console.error(`✗ 找不到${label}：${p}`);
      process.exit(1);
    }
  }
  const text = fs.readFileSync(MD, 'utf-8');
  const clauses = parseClauses(text);

  const data = {
    _说明: '规则条款 ←→ 代码/测试 的登记表。由 tools/gen-rules-map.cjs 生成，tests 字段人工维护。',
    version: 'v1preview1.0',
    source: {
      pdf: path.basename(PDF),
      md: path.basename(MD),
      pdf_sha256_16: sha16(PDF),
      md_sha256_16: sha16(MD),
      pdf_bytes: fs.statSync(PDF).size,
      md_bytes: fs.statSync(MD).size,
    },
    counts: { clauses: clauses.size },
    articles: {},
  };
  for (const [id, info] of clauses) {
    data.articles[id] = { title: info.title, tests: [] };
  }

  if (CHECK) {
    if (!fs.existsSync(OUT)) { console.error('✗ rules-map.json 不存在'); process.exit(1); }
    const old = JSON.parse(fs.readFileSync(OUT, 'utf-8'));
    const missing = Object.keys(data.articles).filter((k) => !old.articles[k]);
    const extra = Object.keys(old.articles).filter((k) => !data.articles[k]);
    const drift = old.source.md_sha256_16 !== data.source.md_sha256_16 || old.source.pdf_sha256_16 !== data.source.pdf_sha256_16;
    console.log(`  md 条款=${clauses.size} · 登记=${Object.keys(old.articles).length} · 缺登=${missing.length} · 多登=${extra.length} · 原件变更=${drift}`);
    if (missing.length) console.log('  缺登示例：' + missing.slice(0, 10).join(', '));
    if (extra.length) console.log('  多登示例：' + extra.slice(0, 10).join(', '));
    if (missing.length || extra.length || drift) process.exit(1);
    console.log('  ✓ rules-map 与正文一致');
    return;
  }

  // 保留人工维护的 tests（重新生成时不清空）
  if (fs.existsSync(OUT)) {
    try {
      const old = JSON.parse(fs.readFileSync(OUT, 'utf-8'));
      for (const [id, v] of Object.entries(old.articles || {})) {
        if (data.articles[id] && Array.isArray(v.tests)) data.articles[id].tests = v.tests;
      }
    } catch { /* 旧文件损坏则直接覆盖 */ }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`  ✓ 写入 ${path.relative(ROOT, OUT)}：${clauses.size} 条条款 · pdf=${data.source.pdf_sha256_16} · md=${data.source.md_sha256_16}`);
}

main();
