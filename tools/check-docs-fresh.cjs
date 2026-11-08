#!/usr/bin/env node
/* ============================================================
   check-docs-fresh.cjs — 文档新鲜度门禁（「推送即同步文档」的可执行版本）

   规则见 AGENTS.md §二。三件事全过才算绿：
     1. docs/变更记录/ 里最新一篇的日期 ≥ 最近一次「人类提交」的日期
        （CI 的 sync( 前缀提交不算，它由工作流自动产生）
     2. 修改记录.md 的「最新一条」指向的就是那一篇
     3. docs/交接文档.md 记录的 HEAD 是当前 HEAD 的祖先，且落后 ≤ 2 个提交
        （留 2 个是因为写文档本身会产生新提交，无法自指）

   用法：
     node tools/check-docs-fresh.cjs
     node tools/check-docs-fresh.cjs --quiet   只输出结论
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CHANGELOG_DIR = path.join(ROOT, 'docs', '变更记录');
const INDEX_MD = path.join(ROOT, '修改记录.md');
const HANDOFF = path.join(ROOT, 'docs', '交接文档.md');
const QUIET = process.argv.includes('--quiet');

const MAX_HEAD_LAG = 2;
let failures = 0;
const ok = (m) => { if (!QUIET) console.log(`  ✓ ${m}`); };
const fail = (m) => { console.log(`  ✗ ${m}`); failures++; };
const warn = (m) => { if (!QUIET) console.log(`  ⚠ ${m}`); };

const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

/* ---------- 0. 是否 git 仓库 ---------- */
if (!git(['rev-parse', '--git-dir'])) {
  console.log('⏭  不是 git 仓库，跳过文档新鲜度检查');
  process.exit(0);
}

/* ---------- 1. 最新变更记录 ---------- */
const records = [];
for (const month of fs.existsSync(CHANGELOG_DIR) ? fs.readdirSync(CHANGELOG_DIR) : []) {
  const dir = path.join(CHANGELOG_DIR, month);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})_(.+)\.md$/);
    if (!m) continue;
    const full = path.join(dir, f);
    records.push({ date: m[1], topic: m[2], file: full, rel: path.posix.join('docs/变更记录', month, f), mtime: fs.statSync(full).mtimeMs });
  }
}
if (!records.length) {
  fail('docs/变更记录/ 下没有任何 YYYY-MM-DD_主题.md 记录');
}
// 同一天有多条记录时，以「最后写入的那篇」为最新，不靠文件名字典序碰运气
records.sort((a, b) => (a.date === b.date ? (a.mtime - b.mtime || a.rel.localeCompare(b.rel)) : a.date.localeCompare(b.date)));
const latest = records[records.length - 1];

/* ---------- 2. 最近一次人类提交 ---------- */
const log = git(['log', '--date=short', '--format=%h|%ad|%an|%s', '-200'])
  .split('\n')
  .filter(Boolean)
  .map((l) => {
    const [hash, date, author, ...rest] = l.split('|');
    return { hash, date, author, subject: rest.join('|') };
  });

const isBot = (c) =>
  /^sync\(/.test(c.subject) || /github-actions/i.test(c.author);

const human = log.find((c) => !isBot(c));
// 只统计「最新记录之后」的机器人提交，否则会把历史 CI 提交全算进来
const botsAfter = latest ? log.filter((c) => isBot(c) && c.date > latest.date).length : 0;

if (!human) {
  warn('找不到人类提交，跳过日期比对');
} else if (latest && latest.date < human.date) {
  fail(
    `最新变更记录是 ${latest.date}（${latest.topic}），但最近一次提交是 ${human.date} ${human.hash} "${human.subject}"\n` +
    `      → 在 docs/变更记录/${human.date.slice(0, 7)}/ 新增 ${human.date}_主题.md（五要素），再刷新修改记录.md`
  );
} else if (latest) {
  ok(`变更记录最新一篇 ${latest.date} ≥ 最近提交 ${human.date}（${human.hash}）`);
  if (botsAfter) warn(`另有 ${botsAfter} 个 CI 自动提交未要求写记录（sync( 前缀）`);
}

/* ---------- 3. 修改记录.md 的「最新一条」 ---------- */
if (!fs.existsSync(INDEX_MD)) {
  fail('根目录找不到 修改记录.md');
} else {
  const txt = fs.readFileSync(INDEX_MD, 'utf8');
  const block = txt.split('LATEST:BEGIN')[1]?.split('LATEST:END')[0] ?? '';
  const m = block.match(/最新一条\**：\s*`?(\d{4}-\d{2}-\d{2})`?\s*·\s*(.+?)\s*→\s*\[[^\]]*\]\(([^)]+)\)/);
  if (!m) {
    fail('修改记录.md 的 LATEST 区块里没有「最新一条：`YYYY-MM-DD` · 主题 → [记录](路径)」这一行');
  } else {
    const [, date, topic, link] = m;
    const target = path.resolve(path.dirname(INDEX_MD), link);
    if (!fs.existsSync(target)) {
      fail(`修改记录.md 指向的记录文件不存在：${link}`);
    } else if (!latest || target !== path.resolve(latest.file)) {
      fail(
        `修改记录.md 指向的是 ${link}，但最新一篇是 ${latest ? latest.rel : '(无)'}\n` +
        `      → 把「最新一条」和「最近变更」表的第一行改成最新那篇`
      );
    } else if (date !== latest.date) {
      fail(`修改记录.md「最新一条」的日期 ${date} 与文件名日期 ${latest.date} 不一致`);
    } else {
      ok(`修改记录.md → ${latest.rel}（${date} · ${topic}）`);
    }
  }
}

/* ---------- 4. 交接文档的 HEAD ---------- */
if (!fs.existsSync(HANDOFF)) {
  fail('docs/交接文档.md 不存在');
} else {
  const txt = fs.readFileSync(HANDOFF, 'utf8');
  const m = txt.match(/当前\s*HEAD\**：\s*`?([0-9a-f]{7,40})`?/i);
  const head = git(['rev-parse', '--short', 'HEAD']);
  if (!m) {
    fail('docs/交接文档.md 里没有「当前 HEAD：`xxxxxxx`」这一行');
  } else {
    const docHead = m[1];
    let isAncestor = false;
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', docHead, 'HEAD'], { cwd: ROOT });
      isAncestor = true;
    } catch { isAncestor = false; }

    if (!isAncestor) {
      fail(`交接文档记的 HEAD ${docHead} 不是当前 HEAD ${head} 的祖先（可能被 rebase/强推过）`);
    } else {
      // 只数「人类提交」：CI 的 sync( 机器人提交会连续产生，不该把交接文档判为过期
      const between = git(['log', '--format=%an|%s', `${docHead}..HEAD`])
        .split('\n').filter(Boolean)
        .map((l) => { const [author, ...rest] = l.split('|'); return { author, subject: rest.join('|') }; });
      const lag = between.filter((c) => !isBot(c)).length;
      if (lag > MAX_HEAD_LAG) {
        fail(
          `交接文档记的 HEAD ${docHead} 落后当前 ${head} 共 ${lag} 个人类提交（上限 ${MAX_HEAD_LAG}；机器人提交不计）\n` +
          `      → 更新交接文档头部、自检清单读数、§九 已知遗留`
        );
      } else {
        ok(`交接文档 HEAD ${docHead} → 当前 ${head}，落后 ${lag}（上限 ${MAX_HEAD_LAG}）`);
      }
    }
  }
}

/* ---------- 结论 ---------- */
console.log('');
if (failures) {
  console.log(`❌ 文档新鲜度未通过：${failures} 项。规则见 AGENTS.md §二。`);
  process.exit(1);
} else if (!QUIET) {
  console.log('✓ 文档新鲜度通过：修改记录、变更记录、交接文档均跟得上 HEAD');
}
