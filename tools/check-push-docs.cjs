#!/usr/bin/env node
/* ============================================================
   check-push-docs.cjs — 本次推送的「改动 ↔ 文档」联动门禁

   和 check-docs-fresh.cjs 的分工：
     - fresh  看时间：最近提交有没有配套日期的记录（防止断更）
     - facts  看内容：文档里的数字/TTL/端点是否与代码一致（防止写错）
     - 本脚本看本次推送：改了实质文件，有没有同时带上变更记录和索引刷新

   为什么不用「最近提交日期」来判：CI 的 sync( 机器人提交会不断把日期推后，
   接进 CI 会误伤。这里按 commit range 逐提交归类，机器人提交天然放行。

   用法：
     node tools/check-push-docs.cjs                       # 自动探测 upstream..HEAD
     node tools/check-push-docs.cjs --base X --head Y    # CI / 手动指定
     node tools/check-push-docs.cjs --stdin              # git pre-push hook
     node tools/check-push-docs.cjs --quiet
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const QUIET = argv.includes('--quiet');
const USE_STDIN = argv.includes('--stdin');
const ZERO = /^0{40}$/;

let failures = 0;
const ok = (m) => { if (!QUIET) console.log(`  ✓ ${m}`); };
const fail = (m) => { console.log(`  ✗ ${m}`); failures++; };
const warn = (m) => { if (!QUIET) console.log(`  ⚠ ${m}`); };

const git = (args) => {
  try {
    return execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch { return ''; }
};

if (!git(['rev-parse', '--git-dir'])) {
  console.log('⏭  不是 git 仓库，跳过推送联动检查');
  process.exit(0);
}

/* ---------- 1. 确定 commit range ---------- */
let base = arg('--base');
let head = arg('--head') || 'HEAD';

if (USE_STDIN) {
  let input = '';
  try { input = fs.readFileSync(0, 'utf8'); } catch { /* 无 stdin */ }
  const lines = input.split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length) {
    const pushes = lines.map((l) => l.split(/\s+/)).filter((p) => !ZERO.test(p[1]));
    if (!pushes.length) { console.log('⏭  删除分支，跳过'); process.exit(0); }
    head = pushes[0][1];
    if (!ZERO.test(pushes[0][3])) base = pushes[0][3];
    if (pushes.length > 1) warn(`一次推 ${pushes.length} 个 ref，本次只检查 ${pushes[0][0]}`);
  }
}

if (!base) {
  for (const cand of ['@{upstream}', 'origin/main', 'gitee/main']) {
    const h = git(['rev-parse', '--verify', cand]);
    if (h) { base = h; break; }
  }
}
if (!base) base = git(['rev-parse', '--verify', 'HEAD^']); // 常规：退回到上一个提交
const ROOT_ONLY = !base;
if (ROOT_ONLY) warn('首次推送（无 upstream / 无 HEAD^）：改为检查 HEAD 可达的全部提交');

const rangeOK = (ROOT_ONLY || git(['rev-parse', '--verify', `${base}^{commit}`])) &&
                git(['rev-parse', '--verify', `${head}^{commit}`]);
if (!rangeOK) {
  fail(`commit range 无效：${base}..${head}（CI 里请确认 fetch-depth 足够）`);
  console.log('');
  process.exit(1);
}

/* ---------- 2. 逐提交归类：机器人提交的文件不算「人类改动」 ---------- */
const range = ROOT_ONLY ? head : `${base}..${head}`;
const raw = git(['log', '--format=@@@%H|%an|%s', '--name-only', range]);
const humanFiles = new Set();
const botFiles = new Set();
let bucket = null;
let commits = 0;
let bots = 0;

for (const line of raw.split('\n')) {
  if (line.startsWith('@@@')) {
    commits++;
    const [hash, author, ...rest] = line.slice(3).split('|');
    const subject = rest.join('|');
    const isBot = /^sync\(/.test(subject) || /github-actions/i.test(author);
    if (isBot) bots++;
    bucket = isBot ? botFiles : humanFiles;
  } else if (line.trim() && bucket) {
    bucket.add(line.trim());
  }
}
// 同一文件若被人类也改过，以人类改动为准
for (const f of humanFiles) botFiles.delete(f);
const files = [...humanFiles].sort();

/* ---------- 3. 分类 ---------- */
const isRecord = (f) => /^docs\/变更记录\/\d{4}-\d{2}\/\d{4}-\d{2}-\d{2}_.+\.md$/.test(f);
const isIndex = (f) => f === '修改记录.md' || f === 'docs/变更记录/README.md';
const isReading = (f) => ['docs/README.md', 'docs/交接文档.md', 'README.md', 'AGENTS.md', 'TECH-RESEARCH.md'].includes(f);
const isDoc = (f) => isRecord(f) || isIndex(f) || isReading(f) || /^docs\/.+\.md$/.test(f);

const substantive = files.filter((f) => !isDoc(f));
const records = files.filter(isRecord);
const indexChanged = files.some(isIndex);
const readingChanged = files.some(isReading);

if (!QUIET) {
  console.log(`  · 范围 ${ROOT_ONLY ? '(root)' : String(base).slice(0, 7)}..${String(head).slice(0, 7)}：` +
              `${commits} 个提交（机器人 ${bots}），人类改动 ${files.length} 个文件`);
}

/* ---------- 4. 判定 ---------- */
if (!commits) {
  ok('没有待推送的新提交');
} else if (!files.length) {
  ok(`本次 ${commits} 个提交全为 CI 机器人提交（sync( / github-actions），按 AGENTS.md §2.5 放行`);
} else if (!substantive.length) {
  ok(`纯文档推送（${files.length} 个文档文件），放行`);
} else if (!records.length) {
  fail(
    `本次推送改了 ${substantive.length} 个实质文件，却没有新增 docs/变更记录/ 记录\n` +
    `      实质文件：${substantive.slice(0, 6).join('、')}${substantive.length > 6 ? ' …' : ''}\n` +
    `      → 新增 docs/变更记录/YYYY-MM/YYYY-MM-DD_主题.md（五要素），再刷新 修改记录.md 的 LATEST`
  );
} else if (!indexChanged) {
  fail(
    `本次有 ${records.length} 篇新记录，但 修改记录.md 没跟着改\n` +
    `      → 刷新 LATEST 区块「最新一条」和「最近变更」表第一行；索引表也加一行`
  );
} else {
  ok(`${substantive.length} 个实质文件 ↔ ${records.length} 篇记录 + 索引刷新，联动完整`);
  if (!readingChanged) {
    warn('阅读文件未更新；若结构/读数/接口/门禁命令变了，请同步 README.md / AGENTS.md 与主文档对应小节');
  }
}

/* ---------- 5. 未提交改动提醒（hook 场景常有） ---------- */
const dirty = git(['status', '--porcelain']);
if (dirty) warn(`工作树有 ${dirty.split('\n').length} 个未提交改动；本门禁只检查已提交内容`);

console.log('');
if (failures) {
  console.log(`❌ 推送联动未通过：${failures} 项。规则见 AGENTS.md §二。`);
  process.exit(1);
} else if (!QUIET) {
  console.log('✓ 推送联动通过');
}
