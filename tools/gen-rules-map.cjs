#!/usr/bin/env node
/* ============================================================
   gen-rules-map.cjs — 规则条款清单 + 测试锚点（docs/data/rules-map.json）
   v2：自动从 tools/test-fix-v26.cjs 的断言名里提取「条款 → 测试」锚点

   锚点口径：断言**名字**里显式写了条款号才算覆盖，不按「碰巧用到该机制」猜测——
   后者会把覆盖率做虚高，而本工具的价值恰恰是如实报出缺口。

   用法：node tools/gen-rules-map.cjs [--check]
   ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'data', 'rules-map.json');
const GAME = path.resolve(ROOT, '..', '太空杀游戏-完整版');
const MD = path.join(GAME, 'attachment-site', '规则正文', '返航录正文v1preview1.0_规则.md');
const PDF = path.join(path.dirname(MD), '返航录三阵营对抗规则·正文v1preview1.0.pdf');
const TEST_FILE = path.join(GAME, 'tools', 'test-fix-v26.cjs');
const CHECK = process.argv.includes('--check');

const sha16 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);

/* 条款标题的可靠性判据（2026-10-21 加）：
 * 正文 md 是 PDF 抽取件，把**夜间步骤号**（0.1 蛰伏 / 0.2 窃听 / 0.5 抑制 / 0.55 致死 / 0.6 进化）
 * 也排成了 `#### 0.1 …` 形态，与 §0 的真实条款同形。若照单全收，
 * 条款表会凭空多出几条「假条款」，覆盖率分母也随之失真。
 *
 * 三条排除（宁可漏登记，不可虚增条款）：
 *   ① 步骤号白名单：0.1 / 0.2 / 0.5 / 0.55 / 0.6 / 3.5 等无上级条款的「小节号」，
 *      其标题必为动作描述（含「步骤」「当夜」或以「外星人/窃听者」开头）——一律不收；
 *   ② 标题过长（> 24 字）：真条款标题都很短，长的是被折断的正文行；
 *   ③ 标题以标点/括号开头，或含「及其后」「原则上」等续行特征。
 * 真条款（0.3~0.7、1.1.1、2.8.15、4.13.3、6.8.3、7.3.0 等）标题均短且不含上述特征。 */
/* ⚠ 不能按「编号白名单」排除：0.5 / 0.6 既是夜间步骤号，**也是真实的 §0 条款**
 *   （0.5 裁判次序、0.6 术语统一）。按编号排除会误杀真条款——第一版就踩了这个坑。
 * 改为**只看标题形态**：真条款标题短（≤12 字）、无动作描述；被误判的是被折断的正文行。 */
function looksLikeStepHeading(id, title) {
  if (!title) return false;
  if (title.length > 24) return true;                       // 长标题＝折断的正文行
  if (/^[、，。；：（）()「」【】]/.test(title)) return true;      // 以标点开头＝续行
  if (/^(及其后|原则|于本步骤|及其|发⽣什么)/.test(title)) return true;
  /* 步骤号特征：标题是**动作描述**（含「步骤」「当夜」「每夜」或角色动作词），且编号在 0.x / 3.5 段 */
  if (/^0\./.test(id) || id === '3.5') {
    if (/步骤|当夜|每夜|查验|读取|进化|转职|蛰伏|窃听|致死|抑制/.test(title)) return true;
  }
  return false;
}

function parseClauses(text) {
  const map = new Map();
  const numbered = /^#{2,4}\s+(\d+(?:\.\d+)+)(?:\s+(.{0,80}))?$/;
  const chapters = /^##\s+(第[0-9一二三四五六七八九十百零两]+[章节篇部回].*?)$/;
  text.split('\n').forEach((line) => {
    const clean = line.replace(/\r$/, '');
    let m = clean.match(numbered);
    if (m) {
      const id = m[1];
      const title = (m[2] || '').trim();
      if (looksLikeStepHeading(id, title)) return;
      const prev = map.get(id);
      if (!prev || (!prev.title && title)) map.set(id, { title });
      return;
    }
    m = clean.match(chapters);
    if (m) {
      const id = m[1].split(/[（(]/)[0].trim();
      if (!map.has(id)) map.set(id, { title: m[1].trim(), chapter: true });
    }
  });
  return map;
}

function parseTestAnchors(file) {
  const anchors = new Map();
  if (!fs.existsSync(file)) return anchors;
  const lines = fs.readFileSync(file, 'utf-8').split('\n');
  const call = /\b(ok|okVoid|okSurfaced)\(\s*(['"])((?:\\.|(?!\2)[^\\])*)\2/;
  const clauseLike = /\b(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)\b/g;
  lines.forEach((line, i) => {
    const m = call.exec(line);
    if (!m) return;
    const name = m[3];
    let hit;
    clauseLike.lastIndex = 0;
    while ((hit = clauseLike.exec(name)) !== null) {
      const id = hit[1];
      const after = name.slice(hit.index + id.length, hit.index + id.length + 1);
      if (/[%％]/.test(after)) continue;
      if (!anchors.has(id)) anchors.set(id, []);
      const ref = 'test-fix-v26.cjs#L' + (i + 1);
      if (!anchors.get(id).includes(ref)) anchors.get(id).push(ref);
    }
  });
  return anchors;
}

function main() {
  for (const [label, p] of [['规则正文 md', MD], ['权威 PDF', PDF]]) {
    if (!fs.existsSync(p)) { console.error('找不到' + label + '：' + p); process.exit(1); }
  }
  const clauses = parseClauses(fs.readFileSync(MD, 'utf-8'));
  const anchors = parseTestAnchors(TEST_FILE);

  const data = {
    _说明: '规则条款 ←→ 测试锚点登记表。由 tools/gen-rules-map.cjs 生成。',
    _口径: '只有断言名里显式写了条款号才算覆盖，以保证覆盖率不虚高。',
    version: 'v1preview1.0',
    source: {
      pdf: path.basename(PDF),
      md: path.basename(MD),
      pdf_sha256_16: sha16(PDF),
      md_sha256_16: sha16(MD),
      pdf_bytes: fs.statSync(PDF).size,
      md_bytes: fs.statSync(MD).size,
      tests: fs.existsSync(TEST_FILE) ? 'test-fix-v26.cjs' : null,
    },
    articles: {},
  };

  let covered = 0;
  for (const [id, info] of clauses) {
    const tests = anchors.get(id) || [];
    if (tests.length) covered++;
    data.articles[id] = { title: info.title, tests };
  }
  data.counts = {
    clauses: clauses.size,
    covered,
    uncovered: clauses.size - covered,
    coverage: clauses.size ? +((covered / clauses.size) * 100).toFixed(1) : 0,
    anchors: [...anchors.values()].reduce((s, a) => s + a.length, 0),
  };

  if (CHECK) {
    if (!fs.existsSync(OUT)) { console.error('rules-map.json 不存在'); process.exit(1); }
    const old = JSON.parse(fs.readFileSync(OUT, 'utf-8'));
    const missing = Object.keys(data.articles).filter((k) => !old.articles[k]);
    const extra = Object.keys(old.articles).filter((k) => !data.articles[k]);
    const drift = old.source.md_sha256_16 !== data.source.md_sha256_16 || old.source.pdf_sha256_16 !== data.source.pdf_sha256_16;
    console.log('  md 条款=' + clauses.size + ' · 登记=' + Object.keys(old.articles).length + ' · 缺登=' + missing.length + ' · 多登=' + extra.length + ' · 原件变更=' + drift);
    if (missing.length || extra.length || drift) process.exit(1);
    console.log('  ✓ rules-map 与正文一致');
    return;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log('  ✓ 写入 ' + path.relative(ROOT, OUT));
  console.log('    条款 ' + data.counts.clauses + ' · 已覆盖 ' + data.counts.covered + ' · 未覆盖 ' + data.counts.uncovered + ' · 覆盖率 ' + data.counts.coverage + '% · 锚点 ' + data.counts.anchors);
}

main();
