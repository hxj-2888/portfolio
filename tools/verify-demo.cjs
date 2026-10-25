/* 演示视频守门：确认首屏展示台与作品卡的「乒乓对决」用的是实机录屏，不是静态截图。
   跑法：node tools/verify-demo.cjs（npm run check:demo）
   断言：视频元素存在且有源 / 能解码出画面（videoWidth>0）/ 标签切换时播与停 /
        海报可用 / 卡片视频进入视口后播放 / 合集页同样可播 / 无 JS 错误与 4xx-5xx。

   ⚠ 依赖本机 Chrome 与 playwright-core（本仓零依赖，不装它）：
     优先用 PORTFOLIO_PW 环境变量指定的模块路径，否则回退到桌面「太空杀」工程已装的副本。 */
const path = require('path'), http = require('http'), fs = require('fs'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
function loadPW() {
  const cands = [
    process.env.PORTFOLIO_PW,
    'C:/Users/ASUS/Desktop/太空杀游戏-完整版/node_modules/playwright-core',
    'playwright-core',
  ].filter(Boolean);
  for (const c of cands) {
    try { return require(c); } catch (e) { /* 试下一个 */ }
  }
  throw new Error('找不到 playwright-core（试过：' + cands.join(' / ') + '）');
}
const { chromium } = loadPW();
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.mp4': 'video/mp4', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};
function serve() {
  const s = http.createServer((q, r) => {
    let u = decodeURIComponent(q.url.split('?')[0]);
    if (u.endsWith('/')) u += 'index.html';
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end('nf'); }
    const st = fs.statSync(f);
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Content-Length': st.size, 'Accept-Ranges': 'bytes' });
    fs.createReadStream(f).pipe(r);
  });
  return new Promise((k) => s.listen(0, () => k(s)));
}
(async () => {
  const outDir = path.join(os.tmpdir(), 'pp-portfolio-verify');
  fs.mkdirSync(outDir, { recursive: true });
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const br = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
  const fails = [];
  const ok = (c, label, extra) => {
    console.log((c ? 'PASS ' : 'FAIL ') + label + (extra ? '  → ' + extra : ''));
    if (!c) fails.push(label);
  };

  // ---------- 首屏 ----------
  const ctx = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  pg.on('response', (r) => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
  await pg.goto(base + '/index.html', { waitUntil: 'load' });
  await pg.waitForTimeout(1200);

  // 默认标签是返航录 → 乒乓视频应暂停
  let v = await pg.evaluate(() => {
    const el = document.querySelector('[data-stage-video]');
    return el ? { paused: el.paused, t: el.currentTime, src: el.getAttribute('src'), poster: el.getAttribute('poster') } : null;
  });
  ok(!!v && !!v.src, '首屏：乒乓展示台已是 <video>', v && v.src);
  ok(v && v.paused === true, '首屏：非当前标签时视频暂停（不抢开局）', v && String(v.paused));
  ok(v && v.poster && fs.existsSync(path.join(ROOT, v.poster)), '首屏：视频有可用 poster 封面', v && v.poster);

  // 切到乒乓标签 → 播放并解码出画面
  await pg.click('.stage__tabs [data-mock="ping-pong-duel"]');
  await pg.waitForTimeout(2600);
  v = await pg.evaluate(() => {
    const el = document.querySelector('[data-stage-video]');
    return { paused: el.paused, t: +el.currentTime.toFixed(2), w: el.videoWidth, h: el.videoHeight, dur: +el.duration.toFixed(2) };
  });
  ok(v.paused === false, '首屏：切到乒乓标签后自动播放', 'paused=' + v.paused);
  ok(v.t > 0.3, '首屏：播放位置在推进', 'currentTime=' + v.t);
  ok(v.w === 1280 && v.h === 720, '首屏：视频解码为 1280×720', v.w + '×' + v.h);
  ok(v.dur > 15, '首屏：时长 >15s（成片不是几秒片段）', v.dur + 's');
  const cap = await pg.textContent('[data-stage-caption]');
  ok(cap.indexOf('侧视角') !== -1 && cap.indexOf('AI') !== -1, '首屏：说明文案写明「AI 对打 · 看台侧视角」', cap.trim().slice(0, 60));
  await pg.screenshot({ path: path.join(outDir, 'hero-pingpong.png') });

  // 切走 → 暂停且归零
  await pg.click('.stage__tabs [data-mock="space-kill"]');
  await pg.waitForTimeout(400);
  v = await pg.evaluate(() => {
    const el = document.querySelector('[data-stage-video]');
    return { paused: el.paused, t: el.currentTime };
  });
  ok(v.paused === true && v.t < 0.2, '首屏：切走后暂停并回到开头', 'paused=' + v.paused + ' t=' + v.t);

  // ---------- 作品卡 ----------
  const card = await pg.evaluate(() => {
    const v = document.querySelector('.card video[data-demo-video]');
    if (!v) return null;
    return {
      src: v.getAttribute('src'),
      poster: v.getAttribute('poster'),
      muted: v.muted, loop: v.loop, inline: v.playsInline,
      badge: !!document.querySelector('.card__badge'),
      imgLeft: document.querySelectorAll('.card__media--ping-pong-duel img').length,
    };
  });
  ok(!!card, '作品卡：乒乓卡媒体区是 <video>');
  ok(card && card.muted && card.loop && card.inline, '作品卡：静音/循环/playsinline 齐全',
    card && `muted=${card.muted} loop=${card.loop} inline=${card.inline}`);
  ok(card && card.imgLeft === 0, '作品卡：静态截图已不在乒乓卡里', card && ('img 数=' + card.imgLeft));
  ok(card && card.badge, '作品卡：带「▶ 演示」角标');
  // 滚到卡片 → 应开始播放
  await pg.evaluate(() => {
    const v = document.querySelector('.card video[data-demo-video]');
    v.scrollIntoView({ block: 'center' });
  });
  await pg.waitForTimeout(3000);
  const cardPlay = await pg.evaluate(() => {
    const v = document.querySelector('.card video[data-demo-video]');
    return { paused: v.paused, t: +v.currentTime.toFixed(2), w: v.videoWidth };
  });
  ok(cardPlay.paused === false && cardPlay.t > 0.3, '作品卡：进入视口后自动播放',
    'paused=' + cardPlay.paused + ' t=' + cardPlay.t + ' w=' + cardPlay.w);
  await pg.screenshot({ path: path.join(outDir, 'cards.png') });

  ok(errs.length === 0, '无 JS 错误 / 无 4xx-5xx 请求', errs.slice(0, 4).join(' | '));
  await ctx.close();

  // ---------- 合集页 ----------
  const ctx2 = await br.newContext({ viewport: { width: 1440, height: 900 } });
  const pg2 = await ctx2.newPage();
  const errs2 = [];
  pg2.on('pageerror', (e) => errs2.push(String(e).slice(0, 200)));
  pg2.on('response', (r) => { if (r.status() >= 400) errs2.push('HTTP ' + r.status() + ' ' + r.url()); });
  await pg2.goto(base + '/projects/game-collection/index.html', { waitUntil: 'load' });
  await pg2.waitForTimeout(3200);
  const coll = await pg2.evaluate(() => {
    const v = document.querySelector('.card--pp video');
    return v ? { paused: v.paused, w: v.videoWidth, t: +v.currentTime.toFixed(2) } : null;
  });
  ok(!!coll && coll.w === 1280, '合集页：乒乓卡视频可解码', coll && (coll.w + '×' + ' t=' + coll.t));
  ok(!!coll && coll.paused === false, '合集页：视频自动播放', coll && ('paused=' + coll.paused));
  await pg2.screenshot({ path: path.join(outDir, 'collection.png') });
  ok(errs2.length === 0, '合集页：无 JS 错误 / 无 4xx-5xx', errs2.slice(0, 4).join(' | '));
  await ctx2.close();

  await br.close();
  srv.close();
  console.log('\n截图目录：' + outDir);
  if (fails.length) { console.log('\n' + fails.length + ' 项失败 ✗'); process.exitCode = 1; }
  else console.log('\n全部通过 ✓');
})().catch((e) => { console.error(e); process.exit(1); });
