/* game-collection/collection.js — 合集入口（零依赖）
   只做一件事：按 CARD_MIN_HEIGHT 之外的平台提示（横屏）与返回链接注入，不接管游戏逻辑。 */
(function () {
  var QS = new URLSearchParams(location.search);
  // 从游戏页返回时带 ?from=game，这里给出“回到顶部”的视觉提示（可选）
  if (QS.get('from') === 'game') {
    var bar = document.createElement('div');
    bar.textContent = '已返回合集';
    bar.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);padding:8px 16px;border-radius:999px;background:#F5A524;color:#1A1204;font:600 13px/1 system-ui;z-index:9';
    document.body.appendChild(bar);
    setTimeout(function () { bar.remove(); }, 1400);
  }
  // 移动端进入返航录前提示横屏
  document.querySelectorAll('[data-landscape]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (window.innerWidth > 820 || window.innerWidth > window.innerHeight) return;
      if (!confirm('返航录需要横屏游玩，继续进入吗？')) e.preventDefault();
    });
  });
  // 演示视频（2026-10-25）：静音自动播放；浏览器策略拦下时保持 poster 帧，不报错。
  // 进视口才播、离开即停——两个卡片的视频不一起解码。
  var vids = Array.prototype.slice.call(document.querySelectorAll('.card__media video'));
  if (!vids.length) return;
  var play = function (v) {
    v.preload = 'auto';
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* 被策略拦下：停在 poster */ });
  };
  if (!('IntersectionObserver' in window)) { vids.forEach(play); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) play(en.target); else en.target.pause();
    });
  }, { threshold: 0.35 });
  vids.forEach(function (v) { io.observe(v); });
})();
