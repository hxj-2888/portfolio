#!/usr/bin/env node
/* ============================================================
   tools/fix-embedded-games.cjs — 合集内嵌游戏产物适配（派生物后处理）

   为什么需要它（2026-10-25）：
     sync.json 的 game-collection 段是一条「派生」流水线——把游戏 A 与游戏 B
     的产物搬进 projects/game-collection/games/。当其中一个源（太空杀）正在重做、
     其别名目录不存在时，sync-projects.js 会**整段失败退出**，于是排在后面的
     乒乓适配补丁也不会跑，合集里的乒乓副本就停在未适配状态：APK 还是相对路径、
     「下载有问题？」指向不存在的 `download`。

     本脚本把「合集内嵌副本的适配」从 sync.json 的派生步骤里独立出来，
     只对**已经入库**的产物做幂等改写，不依赖任何源仓库。

   做的事（全部幂等，可重复执行）：
     · games/ping-pong/index.html 与 download.html 里指向 APK 的相对链接
       → https://ping-pong-duel.pages.dev/<文件名>（作品集不承载二进制）
     · games/ping-pong/index.html 的 href="download" → download.html

   不动的文件：games/space-kill/**（太空杀重做中，等其定版后再处理）。

   用法：node tools/fix-embedded-games.cjs [--check]
        --check 只报告会改什么，不写盘（有需要改的文件时 exit 1）
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAMES = path.join(ROOT, 'projects', 'game-collection', 'games');
const CHECK = process.argv.includes('--check');

const APK_HOST = 'https://ping-pong-duel.pages.dev/';
/** 相对 APK 文件名，例如 PingPongDuel-v331.apk。 */
const APK_FILE_NAME = /PingPongDuel-v[\d.]+\.apk/g;

/**
 * 把引用 APK 的属性值改成游戏站绝对地址。
 * 只处理 `href=="…"` 与 `download="…"` 两种属性：正文里出现的文件名（如下载说明文字）
 * 保持原样，不需要也不应该是完整 URL。
 * 已经带 http(s):// 的跳过，所以重复执行不会叠加前缀。
 */
function absolutizeApk(text) {
  let hits = 0;
  const next = text.replace(/(\b(?:href|download)=")(?!https?:)(PingPongDuel-v[\d.]+\.apk)(")/g, (_, head, file, tail) => {
    hits++;
    return head + APK_HOST + file + tail;
  });
  return { text: next, hits };
}

function main() {
  const targets = [
    path.join('ping-pong', 'download.html'),
    path.join('ping-pong', 'index.html'),
  ];

  let pending = 0;
  for (const rel of targets) {
    const file = path.join(GAMES, rel);
    if (!fs.existsSync(file)) {
      console.log(`  ⚠ 跳过（文件不存在）：${rel}`);
      continue;
    }
    const before = fs.readFileSync(file, 'utf-8');
    const apk = absolutizeApk(before);
    let text = apk.text;
    let hits = apk.hits;

    if (rel.endsWith('index.html')) {
      // 「下载有问题？」指向无扩展名的 `download`，Pages 会把它回退成页面而不是下载帮助页
      const fixedHelp = text.replace(/href="download"/g, 'href="download.html"');
      if (fixedHelp !== text) { hits += 1; text = fixedHelp; }
    }

    if (hits === 0) {
      console.log(`  ✓ 无需修改：${rel}`);
      continue;
    }
    pending++;
    console.log(`  ${CHECK ? '将修改' : '已修改'}：${rel}（${hits} 处）`);
    if (!CHECK) fs.writeFileSync(file, text, 'utf-8');
  }

  if (CHECK && pending > 0) {
    console.log(`\n  ✗ ${pending} 个文件需要适配，运行 node tools/fix-embedded-games.cjs\n`);
    process.exitCode = 1;
    return;
  }
  console.log(`\n  ${CHECK ? '检查完成' : '适配完成'}：${targets.length} 个文件\n`);
}

main();
