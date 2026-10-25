#!/usr/bin/env node
/* ============================================================
   tools/verify-sync.cjs — 在本地复现 deploy.yml 的同步校验
   步骤与 deploy.yml 的「Clone source repos / Re-sync / Verify」三段一致：
     1. 把两个 games 源仓库浅克隆到临时工作区的兄弟目录
     2. 用本仓的 sync.json + sync-projects.js，在 projects/ 的副本上重跑同步
     3. 逐字节比较「重跑结果」与「仓库里入库的 projects/」，列出差异

   注意：space-kill-web 是同步源之一，但太空杀正在重做，其产物随时会变。
   默认**不克隆**它——克隆失败时 game-collection 段的 space-kill 分组会被跳过，
   于是该目录不参与比对（其余文件照常校验）。
   需要连太空杀一起校验时加 `--with-space-kill`。

   用法：
     node tools/verify-sync.cjs                    # 校验（不含太空杀产物）
     node tools/verify-sync.cjs --with-space-kill  # 连太空杀一起校验
     node tools/verify-sync.cjs --fix              # 把重跑结果里不同的文件写回 projects/

   设计说明：
     · 源仓库一律从**远端**克隆，不用本地兄弟目录——本地克隆可能落后或领先远端
       （2026-10-25 就踩过：本地 `太空杀游戏-完整版` 有 7 个未推送提交，直接用它会
       把旧版带进合集）。
     · 临时工作区每次重建，避免上次残留影响结果。
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FIX = process.argv.includes('--fix');
const WITH_SPACE_KILL = process.argv.includes('--with-space-kill');

/** 与 deploy.yml 保持一致的源仓库（仓库地址 → 临时工作区里的目录名）。 */
const GAME_SOURCES = [
  { repo: 'https://github.com/hxj-2888/ping-pong-duel.git', dir: '乒乓对决_合并' },
  // delta-force 的产物也要跟着源走，否则 projects/delta-force 的漂移在本地看不出来
  { repo: 'https://github.com/hxj-2888/delta-force-price-query.git', dir: 'delta-force-deploy' },
];
/** 默认跳过：太空杀重做中（见文件头注释）。 */
const SPACE_KILL_SOURCE = { repo: 'https://github.com/hxj-2888/space-kill-web.git', dir: '太空杀游戏-完整版' };

function git(args, cwd) {
  // 国内网络下拉 GitHub 偶尔 early EOF（curl 56）：同一命令重试几次，
  // 重试前清掉半成品目录，避免 index-pack 残片干扰。
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return execFileSync('git', args, {
        cwd,
        stdio: 'pipe',
        encoding: 'utf8',
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_HTTP_LOW_SPEED_LIMIT: '1000', GIT_HTTP_LOW_SPEED_TIME: '60' },
      }).trim();
    } catch (error) {
      lastError = error;
      if (args[0] === 'clone' && attempt < 3) {
        fs.rmSync(path.join(cwd, args[args.length - 1]), { recursive: true, force: true });
        console.log(`（第 ${attempt} 次克隆中断，重试）`);
      }
    }
  }
  throw lastError;
}

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, base, out);
    else out.push(path.relative(base, abs));
  }
  return out;
}

/** 太空杀重做期间不计入比对的目录（相对 projects/）。 */
const SKIP_DIRS = WITH_SPACE_KILL ? [] : [path.join('game-collection', 'games', 'space-kill')];

const inSkippedDir = (rel) => SKIP_DIRS.some((d) => rel === d || rel.startsWith(d + path.sep));

function main() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-verify-sync-'));
  const copy = path.join(ws, 'portfolio-copy');

  try {
    // 1. 克隆源仓库（与 CI 的 checkout 位置一致：与 portfolio 同级）
    for (const src of GAME_SOURCES) {
      process.stdout.write(`  克隆 ${src.dir} … `);
      git(['clone', '--depth', '1', '--quiet', src.repo, src.dir], ws);
      console.log(git(['rev-parse', '--short', 'HEAD'], path.join(ws, src.dir)));
    }
    if (WITH_SPACE_KILL) {
      process.stdout.write(`  克隆 ${SPACE_KILL_SOURCE.dir} … `);
      git(['clone', '--depth', '1', '--quiet', SPACE_KILL_SOURCE.repo, SPACE_KILL_SOURCE.dir], ws);
      console.log(git(['rev-parse', '--short', 'HEAD'], path.join(ws, SPACE_KILL_SOURCE.dir)));
    } else {
      console.log('  跳过 太空杀游戏-完整版（重做中；如需一并校验加 --with-space-kill）');
    }

    // 太空杀源缺失时 game-collection 段会整段失败退出，其目录下的适配补丁不会执行。
    // verify 只关心「入库的产物是否与源一致」，所以先在副本上跑一遍
    // fix-embedded-games（作用在仓库目录，幂等），把该段的派生产物适配补齐后再复制。

    // 2. 在 projects/ 的副本上重跑同步（源根指向临时工作区）
    fs.mkdirSync(path.join(copy, 'projects'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'sync.json'), path.join(copy, 'sync.json'));
    fs.copyFileSync(path.join(ROOT, 'sync-projects.js'), path.join(copy, 'sync-projects.js'));
    fs.cpSync(path.join(ROOT, 'projects'), path.join(copy, 'projects'), { recursive: true });
    console.log('\n  重跑同步 …');
    // 太空杀源缺失时 sync 会报「base 目录不存在」并失败退 1，这是预期：
    // 只要拿到结果文件即可，故忽略退出码，只打印摘要。
    let syncOut = '';
    try {
      syncOut = execFileSync(process.execPath, [path.join(copy, 'sync-projects.js'), `--src-root=${copy}`], {
        cwd: copy,
        stdio: 'pipe',
        encoding: 'utf8',
        env: { ...process.env, WSLENV: '' },
      });
    } catch (error) {
      syncOut = (error.stdout || '') + (error.stderr || '');
    }
    const summary = syncOut.split('\n').filter((l) => /同步:.+跳过|✗/.test(l));
    summary.forEach((l) => console.log('    ' + l.replace(/\x1b\[[0-9;]*m/g, '').trim()));

    // 2b. 派生产物适配（幂等）：等价于 sync.json 里 game-collection 段尾部的补丁
    try {
      execFileSync(process.execPath, [path.join(ROOT, 'tools', 'fix-embedded-games.cjs')], {
        cwd: ROOT,
        stdio: 'pipe',
        env: { ...process.env },
      });
      console.log('    已执行 fix-embedded-games（合集内嵌副本适配）');
    } catch {
      console.log('    ⚠ fix-embedded-games 执行失败，差异会照常列出');
    }

    // 3. 与仓库里入库的副本逐字节比对
    const resynced = walk(path.join(copy, 'projects')).filter((rel) => !inSkippedDir(rel));
    const diffs = [];
    for (const rel of resynced) {
      const a = path.join(copy, 'projects', rel);
      const b = path.join(ROOT, 'projects', rel);
      if (!fs.existsSync(b)) { diffs.push(`新增 ${rel.replace(/\\/g, '/')}`); continue; }
      if (!fs.readFileSync(a).equals(fs.readFileSync(b))) diffs.push(`变更 ${rel.replace(/\\/g, '/')}`);
    }

    if (diffs.length === 0) {
      console.log(`\n  ✓ projects/ 与源仓库一致${WITH_SPACE_KILL ? '' : '（已跳过太空杀）'}\n`);
      return;
    }

    console.log(`\n  ✗ projects/ 落后于源仓库：${diffs.length} 个文件`);
    diffs.slice(0, 40).forEach((d) => console.log('    ' + d));
    if (diffs.length > 40) console.log(`    … 另有 ${diffs.length - 40} 个`);

    if (FIX) {
      let written = 0;
      for (const rel of resynced) {
        const a = path.join(copy, 'projects', rel);
        const b = path.join(ROOT, 'projects', rel);
        if (fs.existsSync(b) && fs.readFileSync(a).equals(fs.readFileSync(b))) continue;
        fs.mkdirSync(path.dirname(b), { recursive: true });
        fs.copyFileSync(a, b);
        written++;
      }
      console.log(`\n  ✓ 已写回 ${written} 个文件，请运行 node tools/check-*.cjs 后提交\n`);
      return;
    }

    console.log('\n  修复：node tools/verify-sync.cjs --fix\n');
    process.exitCode = 1;
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
}

main();
