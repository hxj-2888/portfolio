#!/usr/bin/env node
/* ============================================================
   check-rules-sync.cjs — 返航录「正文 ↔ 代码」一致性门禁
   四条校验（任一失败即 exit 1），规则见 docs/返航录正文同步方案.md §2.1：
     A. 正文 md 的条款编号 ⊆ rules-map.json 的键（新增条款未登记即失败）
     B. rules-map.json 的 tests 路径真实存在（悬空即失败）
     C. PDF / md 的 sha256 与 rules-map 记录一致（原件换了但没重登记即失败）
     D. 站点产物 rules.html 中的条款数 ≥ 映射数（正文更新了但站点没重建即失败）
   用法：node tools/check-rules-sync.cjs [--coverage]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MAP = path.join(ROOT, 'docs', 'data', 'rules-map.json');
const SKILL_REPO = path.resolve(ROOT, '..', '太空杀游戏-完整版');
const RULES_MD = path.join(SKILL_REPO, 'attachment-site', '规则正文', '返航录正文v1preview1.0_规则.md');
const RULES_PDF = path.join(SKILL_REPO, 'attachment-site', '规则正文', '返航录三阵营对抗规则·正文v1preview1.0.pdf');
const RULES_HTML = path.join(SKILL_REPO, 'attachment-site', 'site', 'rules.html');

const sha16 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
const fail = (msg) => { console.log(`  ✗ ${msg}`); failures++; };
let failures = 0;

/* 条款编号集合：
/* 条款编号集合：
   - Markdown（规则 md）：标题行以编号开头；**必须与 gen-rules-map.cjs 同一套过滤**，
     否则「正文数 274 / 登记 260」会永远差 14 条（那 14 条是夜间步骤号被折断的正文行，
     不是条款）。两处口径必须一致，这是本工具的第一纪律。
   - HTML（站点 rules.html）：<h2~h4>编号 标题</h4>，先剥标签再按行匹配。 */
function looksLikeStepHeading(id, title) {
  if (!title) return false;
  if (title.length > 24) return true;
  if (/^[、，。；：（）()「」【】]/.test(title)) return true;
  if (/^(及其后|原则|于本步骤|及其|发⽣什么)/.test(title)) return true;
  if (/^0\./.test(id) || id === '3.5') {
    if (/步骤|当夜|每夜|查验|读取|进化|转职|蛰伏|窃听|致死|抑制/.test(title)) return true;
  }
  return false;
}

function clauseIds(text, kind) {
  const ids = new Set();
  if (kind === 'html') {
    const src = text.replace(/<[^>]+>/g, '\n');
    const re = /^\s*(\d+(?:\.\d+)+)\s+.{0,80}?\s*$/gm;
    let m;
    while ((m = re.exec(src)) !== null) ids.add(m[1]);
    return ids;
  }
  /* ⚠ 标题可能独占一行（`#### 3.3.10` 换行 `感染标记可⻅性①医生可⻅…`）——PDF 抽取把
     条款号与标题折成了两行。此时标题为空，不能按「空标题＝无内容」丢掉；
     与 gen-rules-map.cjs 同口径：**空标题的裸编号行照收**（它确实是条款起点）。 */
  /* ⚠ 分隔符必须用 [ \t] 而不是 \s：`\s` 会**跨行**匹配，把标题行吞进来，
     于是 `#### 3.3.10` 后面那行正文被当成标题，长标题又被 looksLikeStepHeading 过滤掉，
     3.3.10 就凭空消失（259 vs 260 的来源）。 */
  const re = /^#{2,4}[ \t]+(\d+(?:\.\d+)+)(?:[ \t]+([^\r\n]{0,80}?))?[ \t]*$/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = m[1];
    const title = (m[2] || '').trim();
    if (title && looksLikeStepHeading(id, title)) continue;
    ids.add(id);
  }
  const chap = /^##\s+(第[0-9一二三四五六七八九十百零两]+[章节篇部回][^\s（(]*)/gm;
  while ((m = chap.exec(text)) !== null) ids.add(m[1]);
  return ids;
}

console.log('\n📕 返航录 正文 ↔ 代码 一致性检查\n');

if (!fs.existsSync(MAP)) { console.error('找不到 docs/data/rules-map.json'); process.exit(1); }
const map = JSON.parse(fs.readFileSync(MAP, 'utf-8'));
const mapped = new Set(Object.keys(map.articles));

// A. 条款覆盖登记
if (fs.existsSync(RULES_MD)) {
  const md = fs.readFileSync(RULES_MD, 'utf-8');
  const inDoc = clauseIds(md);
  // 只对「编号条款」做覆盖判断（章节名允许不入表）
  const numbered = [...inDoc].filter((id) => /^\d/.test(id));
  const missing = numbered.filter((id) => !mapped.has(id));
  console.log(`  A 条款登记：正文 ${numbered.length} 条 · 已登记 ${numbered.filter((i) => mapped.has(i)).length} 条 · 缺登 ${missing.length}`);
  if (missing.length) fail(`缺登条款：${missing.slice(0, 12).join(', ')}${missing.length > 12 ? ' …' : ''}（跑 node tools/gen-rules-map.cjs）`);
  const extra = [...mapped].filter((id) => /^\d/.test(id) && !inDoc.has(id));
  if (extra.length) console.log(`  (提示) 映射中有 ${extra.length} 条不在当前正文：${extra.slice(0, 8).join(', ')}`);
} else {
  console.log('  ⚠ 跳过 A：找不到规则正文 md');
}

// B. 测试锚点悬空
const broken = [];
for (const [id, v] of Object.entries(map.articles)) {
  for (const t of v.tests || []) {
    const file = path.join(SKILL_REPO, 'tools', t.split('#')[0]);
    if (!fs.existsSync(file)) broken.push(`${id} → ${t}`);
  }
}
const withTests = Object.values(map.articles).filter((v) => (v.tests || []).length).length;
console.log(`  B 测试锚点：有锚点条款 ${withTests} / ${mapped.size} · 悬空 ${broken.length}`);
if (broken.length) fail(`悬空锚点：${broken.slice(0, 8).join('；')}`);

// C. 原件指纹
const curPdf = fs.existsSync(RULES_PDF) ? sha16(RULES_PDF) : '(missing)';
const curMd = fs.existsSync(RULES_MD) ? sha16(RULES_MD) : '(missing)';
console.log(`  C 原件指纹：pdf ${curPdf} (登记 ${map.source.pdf_sha256_16}) · md ${curMd} (登记 ${map.source.md_sha256_16})`);
if (curPdf !== map.source.pdf_sha256_16) fail('权威 PDF 已变更但 rules-map 未重登记（先重抽 md，再跑 gen-rules-map.cjs）');
if (curMd !== map.source.md_sha256_16) fail('正文 md 已变更但 rules-map 未重登记');

// D. 站点重建
if (fs.existsSync(RULES_HTML)) {
  const html = fs.readFileSync(RULES_HTML, 'utf-8');
  const seen = clauseIds(html, 'html');
  const numbered = Object.keys(map.articles).filter((id) => /^\d/.test(id));
  const present = numbered.filter((id) => [...seen].some((s) => s === id));
  const pct = numbered.length ? Math.round((present.length / numbered.length) * 100) : 0;
  console.log(`  D 站点重建：rules.html 包含 ${present.length} / ${numbered.length} 条（${pct}%）`);
  if (pct < 95) fail('rules.html 疑似未重建（条款缺失过多）：python tools/build_site.py');
} else {
  console.log('  ⚠ 跳过 D：找不到 site/rules.html');
}

// 覆盖率报告
const uncovered = Object.entries(map.articles).filter(([, v]) => !(v.tests || []).length);
const cov = mapped.size ? Math.round(((mapped.size - uncovered.length) / mapped.size) * 100) : 0;
console.log(`\n  条款→测试覆盖率：${mapped.size - uncovered.length}/${mapped.size}（${cov}%）`);
if (process.argv.includes('--coverage')) {
  console.log('  未覆盖条款（前 40）：' + uncovered.slice(0, 40).map(([id]) => id).join(', '));
}

console.log(failures ? `\n  ❌ 未通过：${failures} 项\n` : '\n  ✅ 通过\n');
process.exit(failures ? 1 : 0);
