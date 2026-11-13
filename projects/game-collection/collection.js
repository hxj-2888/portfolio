/* ============================================================
   collection.js — 游戏合集入口（零依赖）
   只做三件事：返回提示、移动端横屏提示、演示视频进入视口播放。
   不接管任何游戏逻辑，也不改各游戏的 localStorage 键。
   ============================================================ */
(function () {
  var QS = new URLSearchParams(location.search);

  // 从游戏页返回时带 ?from=game，给一个短暂的返回提示
  if (QS.get('from') === 'game') {
    var bar = document.createElement('div');
    bar.textContent = '已返回合集';
    bar.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);padding:8px 16px;border-radius:2px;background:#A33A2A;color:#fff;font:600 13px/1 system-ui;z-index:9;box-shadow:0 6px 18px rgba(15,20,24,.18)';
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

  // 演示视频：静音自动播放；进视口才播、离开即停。
  // 用户要求减弱动效时不自动播放，保留 poster 帧。
  var vids = Array.prototype.slice.call(document.querySelectorAll('.entry__media video'));
  if (!vids.length) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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
