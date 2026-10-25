#!/usr/bin/env node
/* ============================================================
   tools/verify-sync.cjs — 在本地复现 deploy.yml 的同步校验
   步骤与 deploy.yml 的「Clone source repos / Re-sync / Verify」三段一致：
     1. 把三个源仓库浅克隆到临时工作区的兄弟目录
     2. 用本仓的 sync.json + sync-projects.js，在 projects/ 的副本上重跑同步
     3. 逐字节比较「重跑结果」与「仓库里入库的 projects/」，列出差异

   用法：
     node tools/verify-sync.cjs            # 校验，有差异时 exit 1
     node tools/verify-sync.cjs --fix      # 把重跑结果里不同的文件写回 projects/

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

/** 与 deploy.yml 保持一致的三个源仓库（仓库地址 → 临时工作区里的目录名）。 */
const SOURCES = [
  { repo: 'https://github.com/hxj-2888/ping-pong-duel.git', dir: '乒乓对决_合并' },
  { repo: 'https://github.com/hxj-2888/space-kill-web.git', dir: '太空杀游戏-完整版' },
  { repo: 'https://github.com/hxj-2888/delta-force-price-query.git', dir: 'delta-force-deploy' },
];

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

function main() {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-verify-sync-'));
  const copy = path.join(ws, 'portfolio-copy');
  fs.mkdirSync(path.join(copy, 'projects'), { recursive: true });

  try {
    // 1. 克隆源仓库（与 CI 的 checkout 位置一致：与 portfolio 同级）
    for (const src of SOURCES) {
      process.stdout.write(`  克隆 ${src.dir} … `);
      git(['clone', '--depth', '1', '--quiet', src.repo, src.dir], ws);
      const head = git(['rev-parse', '--short', 'HEAD'], path.join(ws, src.dir));
      console.log(head);
    }

    // 2. 在 projects/ 的副本上重跑同步（源根指向临时工作区）
    fs.copyFileSync(path.join(ROOT, 'sync.json'), path.join(copy, 'sync.json'));
    fs.copyFileSync(path.join(ROOT, 'sync-projects.js'), path.join(copy, 'sync-projects.js'));
    fs.cpSync(path.join(ROOT, 'projects'), path.join(copy, 'projects'), { recursive: true });
    console.log('\n  重跑同步 …');
    execFileSync(process.execPath, [path.join(copy, 'sync-projects.js'), `--src-root=${copy}`], {
      cwd: copy,
      stdio: 'pipe',
      env: { ...process.env, WSLENV: '' },
    });

    // 3. 与仓库里入库的副本逐字节比对
    const resynced = walk(path.join(copy, 'projects'));
    const diffs = [];
    for (const rel of resynced) {
      const a = path.join(copy, 'projects', rel);
      const b = path.join(ROOT, 'projects', rel);
      if (!fs.existsSync(b)) { diffs.push(`新增 ${rel.replace(/\\/g, '/')}`); continue; }
      if (!fs.readFileSync(a).equals(fs.readFileSync(b))) diffs.push(`变更 ${rel.replace(/\\/g, '/')}`);
    }

    if (diffs.length === 0) {
      console.log('\n  ✓ projects/ 与源仓库一致\n');
      return;
    }

    console.log(`\n  ✗ projects/ 落后于源仓库：${diffs.length} 个文件`);
    diffs.slice(0, 40).forEach((d) => console.log('    ' + d));
    if (diffs.length > 40) console.log(`    … 另有 ${diffs.length - 40} 个`);

    if (FIX) {
      for (const rel of resynced) {
        const a = path.join(copy, 'projects', rel);
        const b = path.join(ROOT, 'projects', rel);
        if (fs.existsSync(b) && fs.readFileSync(a).equals(fs.readFileSync(b))) continue;
        fs.mkdirSync(path.dirname(b), { recursive: true });
        fs.copyFileSync(a, b);
      }
      console.log(`\n  ✓ 已写回 ${diffs.length} 个文件，请运行 node tools/check-*.cjs 后提交\n`);
      return;
    }

    console.log('\n  修复：node tools/verify-sync.cjs --fix\n');
    process.exitCode = 1;
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
}

main();
