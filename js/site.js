/* ============================================================
   site.js — 作品集交互（零依赖，数据驱动）
   数据源：projects.json（唯一真相）。首屏核对清单、作品面板、弹窗都从这里渲染。

   2026-11-09 重做要点：
     · 首屏 = 核对清单 + 正在运行的产物。清单行**从 DOM 里已存在的
       .artifact__pane 反查项目**，而不是各写一份名单 —— 否则「清单说在跑」
       和「实际能切的产物」迟早会漂移。
     · 版式由 layout 决定：versions / split / data / note。三款软件各按自己
       的性质排，不再共用一张「图+标题+三标签+两按钮」的卡片模板。
     · status=local 的形态**不给链接**。没有可打开的产物，给个按钮就是
       把它画成「可做」，这正是本站声称要避免的事。
     · 不写内联 style：首页 CSP 是 style-src 'self'，作品色走 .hue-* 类。
   ============================================================ */

/* ---------- 基础 ----------
   2026-11-09：移除手绘 inline SVG 图标层。
   依据 portfolio AGENTS.md §2.8（四项目统一裁定）：素材优先取公开/开源且必须留署名，
   缺署名一律不上站；自绘图标既非开源来源也无署名，属于该删的装饰。
   文字链接（GitHub / 打开站点 / 扫码）本身已足够清楚，不需要图标陪衬。 */
let PROJECTS = [];
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const el = (tag, cls, html) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
};
const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const setText = (node, text) => { node.textContent = text; };

/* 只挡危险协议；相对素材路径（assets/…、projects/…）与 http(s)/mailto/# 都放行。
   上一版用白名单前缀，把 assets/ 误判成 null，导致面板图与演示视频 src 被置空。 */
const safeUrl = (u) => {
  if (!u) return null;
  const s = String(u).trim();
  if (/^(javascript|data|vbscript|file):/i.test(s)) return null;
  return s;
};
const hueClass = (p) => 'hue-' + (p.hue || 'none');
const isExternal = (u) => /^https?:/i.test(u);

/* 状态词：只陈述事实，不用形容词 */
const STATE_TEXT = { live: '在线', local: '仅本机工程', collection: '在游戏合集里' };

function linkEl(url, label, cls) {
  const u = safeUrl(url);
  if (!u) return null;
  const a = el('a', cls);
  a.href = u;
  if (isExternal(u)) { a.target = '_blank'; a.rel = 'noopener'; }
  a.appendChild(document.createTextNode(label));
  return a;
}

/* ---------- 首屏核对清单：从已存在的 pane 反查项目 ---------- */
function renderRail() {
  const rail = $('[data-rail]');
  if (!rail) return;
  const panes = $$('.artifact__pane');
  rail.innerHTML = '';
  panes.forEach((pane, i) => {
    const p = PROJECTS.find((x) => x.id === pane.dataset.mock);
    if (!p) return;
    const row = el('button', 'rail__row ' + hueClass(p));
    row.type = 'button';
    row.setAttribute('role', 'tab');
    row.dataset.mock = p.id;
    row.dataset.status = p.status || 'live';
    row.setAttribute('aria-selected', String(i === 0));
    row.setAttribute('aria-label', p.name + '，切换到它在首屏运行');
    row.appendChild(el('span', 'rail__dot'));
    const mid = el('span', '');
    mid.appendChild(el('span', 'rail__name', escapeHtml(p.name)));
    mid.appendChild(el('span', 'rail__line', escapeHtml(p.tagline || '')));
    mid.appendChild(el('span', 'rail__state', escapeHtml(STATE_TEXT[p.status || 'live'] || '')));
    row.appendChild(mid);
    row.appendChild(el('span', 'rail__proof', escapeHtml(p.proof || '')));
    rail.appendChild(row);
  });
}

/* ---------- 首屏运行位 ---------- */
function bindStage() {
  const panes = $$('.artifact__pane');
  if (!panes.length) return;
  const rows = $$('.rail__row');
  const proof = $('[data-artifact-proof]');
  const videos = $$('[data-stage-video]');

  const syncVideo = (key) => {
    videos.forEach((v) => {
      const pane = v.closest('.artifact__pane');
      const active = pane && pane.dataset.mock === key;
      if (active) {
        const pr = v.play();
        if (pr && typeof pr.catch === 'function') pr.catch(() => {});
      } else {
        v.pause();
        /* 元数据未载入时重置 currentTime 会中止正在进行的请求（表现为一条
           假的 requestfailed）。等 readyState>0 再归零。 */
        if (v.readyState > 0) { try { v.currentTime = 0; } catch (_) { /* 不可 seek */ } }
      }
    });
  };

  const show = (key) => {
    panes.forEach((p) => p.classList.toggle('is-on', p.dataset.mock === key));
    rows.forEach((r) => r.setAttribute('aria-selected', String(r.dataset.mock === key)));
    const p = PROJECTS.find((x) => x.id === key);
    if (proof) {
      proof.innerHTML = '';
      if (p) {
        const u = safeUrl(p.proofUrl);
        const label = p.proof ? p.name + ' · ' + p.proof : p.name;
        if (u) {
          const a = linkEl(u, label, '');
          if (a) proof.appendChild(a); else proof.appendChild(document.createTextNode(label));
        } else {
          proof.appendChild(document.createTextNode(label));
        }
        const st = el('span', '', ' — ' + (STATE_TEXT[p.status || 'live'] || ''));
        proof.appendChild(st);
      }
    }
    syncVideo(key);
  };

  rows.forEach((r) => r.addEventListener('click', () => show(r.dataset.mock)));
  /* 键盘：清单是 tablist，左右方向键要在行之间走 */
  rows.forEach((r, i) => r.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1
      : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = rows[(i + d + rows.length) % rows.length];
    next.focus(); show(next.dataset.mock);
  }));

  const first = rows[0];
  if (first) show(first.dataset.mock);

  document.addEventListener('visibilitychange', () => {
    const active = $('.artifact__pane.is-on');
    if (!active) return;
    syncVideo(document.hidden ? '' : active.dataset.mock);
  });
}

/* ---------- 面板零件 ---------- */
function actionsEl(p) {
  const box = el('div', 'links');
  const canPreview = Boolean(p.entry && p.source);
  if (canPreview) {
    const a = el('a', 'btn btn--solid');
    a.href = '#preview';
    a.dataset.preview = p.id;
    a.appendChild(document.createTextNode('在线预览'));
    box.appendChild(a);
  }
  const live = linkEl(p.liveUrl, '打开站点', canPreview ? 'btn btn--line' : 'btn btn--solid');
  if (live) box.appendChild(live);
  if (p.qr && p.qr.src) {
    const q = el('button', 'note__qr');
    q.type = 'button';
    q.dataset.qr = p.qr.src;
    q.dataset.qrTitle = p.qr.title || (p.name + ' · 扫码');
    q.setAttribute('aria-label', (p.qr.title || p.name) + '，扫码打开');
    q.appendChild(document.createTextNode('扫码'));
    box.appendChild(q);
  }
  return box;
}

function linksEl(p) {
  const box = el('div', 'links');
  (p.links || []).forEach((l) => {
    const a = linkEl(l.url, l.label, '');
    if (a) box.appendChild(a);
  });
  return box.childElementCount ? box : null;
}

function tagsEl(p) {
  const box = el('div', 'links');
  (p.tags || []).slice(0, 3).forEach((t) => box.appendChild(el('span', 'badge badge--hue', escapeHtml(t))));
  return box.childElementCount ? box : null;
}

function specEl(rows) {
  if (!rows || !rows.length) return null;
  const wrap = el('div', 'spec');
  rows.forEach((r) => {
    const row = el('div', '');
    row.appendChild(el('span', 'spec__k', escapeHtml(r.k)));
    const v = el('span', 'spec__v');
    v.appendChild(r.mono ? el('em', '', escapeHtml(r.v)) : document.createTextNode(r.v));
    row.appendChild(v);
    wrap.appendChild(row);
  });
  return wrap;
}

function mediaEl(p) {
  const box = el('div', p.layout === 'data' ? 'data__media' : 'split__media');
  if (p.demo) {
    const v = el('video', '');
    const src = safeUrl(p.demo.src);
    if (!src) return null;
    v.src = src;
    const poster = safeUrl(p.demo.poster);
    if (poster) v.poster = poster;
    v.muted = true; v.loop = true; v.playsInline = true;
    v.preload = 'none';
    v.setAttribute('aria-label', p.name + ' 实机演示');
    v.dataset.demoVideo = '1';
    box.appendChild(v);
    return box;
  }
  if (p.thumbnail) {
    const webp = safeUrl(p.thumbnail.replace(/\.png$/, '.webp'));
    const small = safeUrl(p.thumbnail.replace(/\.png$/, '-640.webp'));
    const pic = document.createElement('picture');
    if (webp && small) {
      const s = el('source');
      s.type = 'image/webp';
      s.srcset = `${small} 640w, ${webp} 1200w`;
      s.sizes = '(max-width: 760px) 100vw, 640px';
      pic.appendChild(s);
    }
    const img = el('img');
    img.src = safeUrl(p.thumbnail) || '';
    img.alt = p.name + ' 界面';
    img.loading = 'lazy'; img.decoding = 'async';
    img.width = 960; img.height = 600;
    pic.appendChild(img);
    box.appendChild(pic);
    return box;
  }
  return null;
}

function versionsEl(p) {
  if (!p.versions || !p.versions.length) return null;
  const wrap = el('div', 'versions');
  p.versions.forEach((v) => {
    const row = el('div', 'version');
    row.appendChild(el('div', 'version__name', escapeHtml(v.name)));
    row.appendChild(el('div', 'version__desc', escapeHtml(v.desc || '')));
    const proof = el('div', 'version__proof');
    const pu = safeUrl(v.proofUrl);
    if (pu) {
      const a = linkEl(pu, v.proof || v.name, '');
      if (a) proof.appendChild(a);
    } else {
      proof.appendChild(document.createTextNode(v.proof || ''));
    }
    row.appendChild(proof);

    const state = el('div', 'version__state');
    const cls = v.status === 'live' ? 'state state--live' : v.status === 'local' ? 'state state--local' : 'state';
    state.appendChild(el('span', cls, escapeHtml(STATE_TEXT[v.status] || v.status || '')));
    /* 只有真有产物的形态才配链接；local 不给按钮 */
    if (v.status !== 'local') {
      const a = linkEl(v.url, v.status === 'collection' ? '在合集里打开' : '打开', 'version__link');
      if (a) state.appendChild(a);
      else state.appendChild(el('span', 'version__none', '暂无可打开的地址'));
    } else {
      state.appendChild(el('span', 'version__none', '无网页产物'));
    }
    row.appendChild(state);
    wrap.appendChild(row);
  });
  return wrap;
}

function figuresEl(p) {
  if (!p.figures || !p.figures.length) return null;
  const wrap = el('div', 'data__figures');
  p.figures.forEach((f) => {
    const fig = el('div', 'data__fig');
    fig.appendChild(el('span', 'num', escapeHtml(f.value)));
    fig.appendChild(el('div', 'data__cap', escapeHtml(f.cap)));
    wrap.appendChild(fig);
  });
  return wrap;
}

/* ---------- 版式分发 ---------- */
function caseEl(p) {
  const a = el('article', 'case ' + hueClass(p));
  a.id = 'case-' + p.id;

  const h = el('h3', 'case__title');
  h.appendChild(document.createTextNode(p.name));
  if (p.kicker) h.appendChild(el('span', 'case__tag', escapeHtml(p.kicker)));
  a.appendChild(h);
  a.appendChild(el('p', 'case__lead', escapeHtml(p.lead || p.tagline || '')));
  if (p.lead && p.tagline) a.appendChild(el('p', 'case__note', escapeHtml(p.tagline)));

  if (p.layout === 'versions') {
    const v = versionsEl(p); if (v) a.appendChild(v);
    const s = specEl(p.spec); if (s) a.appendChild(s);
  } else if (p.layout === 'split') {
    const grid = el('div', 'split');
    const m = mediaEl(p); if (m) grid.appendChild(m);
    const s = specEl(p.spec);
    if (s) grid.appendChild(s); else {
      const alt = el('div', '');
      const t = tagsEl(p); if (t) alt.appendChild(t);
      if (alt.childElementCount) grid.appendChild(alt);
    }
    if (grid.childElementCount) a.appendChild(grid);
  } else if (p.layout === 'data') {
    const wrap = el('div', 'data');
    const f = figuresEl(p); if (f) wrap.appendChild(f);
    const m = mediaEl(p); if (m) wrap.appendChild(m);
    if (wrap.childElementCount) a.appendChild(wrap);
  }

  const tags = tagsEl(p); if (tags) a.appendChild(tags);
  const acts = actionsEl(p); if (acts.childElementCount) a.appendChild(acts);
  const ls = linksEl(p); if (ls) a.appendChild(ls);
  return a;
}

function noteEl(p) {
  const n = el('article', 'note ' + hueClass(p));
  n.appendChild(el('h3', '', escapeHtml(p.name)));
  n.appendChild(el('p', '', escapeHtml(p.tagline || p.lead || '')));
  const ls = linksEl(p); if (ls) n.appendChild(ls);
  /* note 不给实心大按钮：过程资料不抢作品的排面，只给文字级入口 */
  const row = el('div', 'links');
  if (p.entry && p.source) {
    const a = el('a', '');
    a.href = '#preview'; a.dataset.preview = p.id;
    a.appendChild(document.createTextNode('在线预览'));
    row.appendChild(a);
  }
  const live = linkEl(p.liveUrl, '打开站点', '');
  if (live) row.appendChild(live);
  if (p.qr && p.qr.src) {
    const q = el('button', 'note__qr');
    q.type = 'button';
    q.dataset.qr = p.qr.src;
    q.dataset.qrTitle = p.qr.title || (p.name + ' · 扫码');
    q.setAttribute('aria-label', (p.qr.title || p.name) + '，扫码打开');
    q.appendChild(document.createTextNode('扫码'));
    row.appendChild(q);
  }
  if (row.childElementCount) n.appendChild(row);
  return n;
}

function renderCases() {
  const works = $('[data-cases]:not([data-cases="process"])');
  const proc = $('[data-cases="process"]');
  const ordered = PROJECTS.slice().sort((a, b) => {
    if (a.band !== b.band) return a.band ? -1 : 1;
    return (a.order ?? 99) - (b.order ?? 99);
  });

  if (works) {
    works.innerHTML = '';
    const full = ordered.filter((p) => p.group !== 'process' && p.layout !== 'note');
    full.forEach((p) => works.appendChild(caseEl(p)));
    const notes = ordered.filter((p) => p.group !== 'process' && p.layout === 'note');
    if (notes.length) {
      const wrap = el('div', 'notes');
      notes.forEach((p) => wrap.appendChild(noteEl(p)));
      works.appendChild(wrap);
    }
  }
  if (proc) {
    proc.innerHTML = '';
    proc.className = 'notes';
    ordered.filter((p) => p.group === 'process').forEach((p) => proc.appendChild(noteEl(p)));
  }

  /* 「可玩网页游戏」由 countsAsGame 实时算，不手写 */
  const gameCount = PROJECTS.filter((p) => p.group === 'play' && p.countsAsGame).length;
  $$('[data-count="games"]').forEach((n) => setText(n, String(gameCount)));
}

/* ---------- 预览弹窗 ---------- */
function openPreview(id) {
  const p = PROJECTS.find((x) => x.id === id);
  if (!p || !p.entry) return;
  const modal = $('#previewModal');
  setText($('#pmTitle'), p.name);
  setText($('#pmSub'), (p.tags || []).join(' / '));
  $('#pmFrame').src = 'projects/' + p.id + '/' + p.entry;
  const live = $('#pmLive');
  if (p.liveUrl) { live.href = p.liveUrl; live.hidden = false; } else { live.hidden = true; }
  modal.dataset.open = 'true';
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  $('.modal__close', modal)?.focus();
}
function closePreview() {
  const modal = $('#previewModal');
  if (modal.dataset.open !== 'true') return;
  modal.dataset.open = 'false';
  modal.setAttribute('aria-hidden', 'true');
  $('#pmFrame').src = 'about:blank';
  document.body.style.overflow = '';
}

/* ---------- 二维码弹窗 ---------- */
function showQr(src, title) {
  const modal = $('#qrModal');
  setText($('#qrTitle'), title);
  $('#qrImg').src = src;
  modal.dataset.open = 'true';
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  $('.modal__close', modal)?.focus();
}
function closeQr() {
  const modal = $('#qrModal');
  if (modal.dataset.open !== 'true') return;
  modal.dataset.open = 'false';
  modal.setAttribute('aria-hidden', 'true');
  $('#qrImg').src = '';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closePreview(); closeQr(); }
});
document.addEventListener('click', (e) => {
  const closer = e.target.closest('[data-close]');
  if (closer) { e.preventDefault(); closer.dataset.close === 'qr' ? closeQr() : closePreview(); return; }
  const preview = e.target.closest('[data-preview]');
  if (preview) { e.preventDefault(); openPreview(preview.dataset.preview); return; }
  const qr = e.target.closest('[data-qr]');
  if (qr) { e.preventDefault(); showQr(qr.dataset.qr, qr.dataset.qrTitle || ''); return; }
  const copy = e.target.closest('[data-copy-mail]');
  if (copy) copyMail(copy);
});
$$('.modal').forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m) m.querySelector('[data-close]')?.click(); });
});

/* ---------- 复制邮箱 ---------- */
async function copyMail(btn) {
  const text = btn.dataset.copyMail || '';
  try {
    await navigator.clipboard.writeText(text);
    setText(btn, '已复制');
    setTimeout(() => setText(btn, '复制'), 1500);
  } catch (_) {
    setText(btn, '复制失败');
    setTimeout(() => setText(btn, '复制'), 1500);
  }
}

/* ---------- 导航：当前分区 ---------- */
function bindNav() {
  const nav = $('[data-section-nav]');
  if (!nav) return;
  const links = $$('a', nav);
  const sections = links
    .map((a) => document.getElementById(a.getAttribute('href').slice(1)))
    .filter(Boolean);
  if (!sections.length || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + entry.target.id)));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => io.observe(s));
}

/* ---------- 数字递增（只在进视口时跑一次；reduced-motion 直接给终值） ---------- */
function countUp(node, to) {
  if (reduceMotion() || to < 2) { setText(node, to.toLocaleString('en-US')); return; }
  const t0 = performance.now(), dur = 1100;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    setText(node, Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString('en-US'));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function bindCounters() {
  const counters = $$('[data-to]');
  if (!counters.length) return;
  if (!('IntersectionObserver' in window) || reduceMotion()) {
    counters.forEach((n) => countUp(n, Number(n.dataset.to)));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.target.dataset.counted === '1') return;
      entry.target.dataset.counted = '1';
      countUp(entry.target, Number(entry.target.dataset.to));
      io.unobserve(entry.target);
    });
  }, { threshold: 0.4 });
  counters.forEach((n) => io.observe(n));
}

/* ---------- 面板里的演示视频：进视口才播，离开即停 ---------- */
function bindDemoVideos() {
  const vids = $$('video[data-demo-video]');
  if (!vids.length) return;
  const play = (v) => {
    v.preload = 'auto';
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  };
  if (!('IntersectionObserver' in window) || reduceMotion()) { vids.forEach(play); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { e.isIntersecting ? play(e.target) : e.target.pause(); });
  }, { threshold: 0.35 });
  vids.forEach((v) => io.observe(v));
}

/* ---------- 启动 ---------- */
bindStage();
bindNav();
fetch('projects.json', { cache: 'no-cache' })
  .then((r) => { if (!r.ok) throw new Error('projects.json ' + r.status); return r.json(); })
  .then((data) => {
    PROJECTS = (data.projects || []).slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    renderRail();
    renderCases();
    bindStage();
    bindDemoVideos();
    bindCounters();
  })
  .catch((err) => {
    console.error('[site] 项目数据加载失败：', err);
    const mount = $('[data-cases]:not([data-cases="process"])');
    if (mount) mount.appendChild(el('p', 'case__note', '项目数据加载失败，请刷新重试。'));
    bindCounters();
  });
