/* ============================================================
   site.js — 检验单版作品集交互（零依赖）

   数据源：projects.json（唯一真相）。构建时由 tools/inline-projects.cjs
   把同一份数据写进 index.html 的 #projects-data，页面首屏不再发出第二个
   请求；fetch 只作为缺少内联块时的兜底。这样网络抖动只会影响样式/脚本，
   不会再把整块作品区打成空白。

   2026-11-12 重做要点：
     · 首屏样张的标签从已存在的 .artifact__pane 反查项目，不另写名单。
     · 作品区按「检验项」渲染：左栏状态/名称/口径，右栏证据与入口。
     · status=local 的形态渲染成虚线「待接入」槽位，不配链接；3D 版就是
       这样留位的。另一条工作流把它改成 status=live 并补 url 即可。
     · 颜色只保留朱红（验收章/待检）与松绿（在线），不给作品分配色块。
     · 不写内联 style：首页 CSP 是 style-src 'self'。
   ============================================================ */

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

/* 只挡危险协议；相对素材路径与 http(s)/mailto/# 都放行。 */
const safeUrl = (u) => {
  if (!u) return null;
  const s = String(u).trim();
  if (/^(javascript|data|vbscript|file):/i.test(s)) return null;
  return s;
};
const isExternal = (u) => /^https?:/i.test(u);

/* 状态词只陈述事实，不用形容词 */
const STATE_TEXT = { live: '在线', local: '待接入', collection: '在合集里' };
const STATE_CLASS = { live: 'chip--live', local: 'chip--pending', collection: 'chip--collection' };

function linkEl(url, label, cls) {
  const u = safeUrl(url);
  if (!u) return null;
  const a = el('a', cls);
  a.href = u;
  if (isExternal(u)) { a.target = '_blank'; a.rel = 'noopener'; }
  a.appendChild(document.createTextNode(label));
  return a;
}

/* ---------- 首屏样张：标签从 pane 反查 ---------- */
function renderSampleTabs() {
  const mount = $('[data-rail]');
  if (!mount) return;
  const panes = $$('.artifact__pane');
  mount.innerHTML = '';
  panes.forEach((pane) => {
    const p = PROJECTS.find((x) => x.id === pane.dataset.mock);
    if (!p) return;
    const btn = el('button', 'sample__tab');
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.dataset.mock = p.id;
    btn.dataset.status = p.status || 'live';
    btn.setAttribute('aria-selected', String(pane.classList.contains('is-on')));
    btn.setAttribute('aria-label', p.name + '，切换到它在首屏运行');
    btn.appendChild(el('span', 'sample__dot'));
    btn.appendChild(document.createTextNode(p.name));
    mount.appendChild(btn);
  });
}

/* ---------- 首屏运行位 ---------- */
function bindStage() {
  const panes = $$('.artifact__pane');
  if (!panes.length) return;
  const rows = $$('.sample__tab');
  const proof = $('[data-artifact-proof]');
  const videos = $$('[data-stage-video]');

  const syncVideo = (key) => {
    videos.forEach((v) => {
      const pane = v.closest('.artifact__pane');
      const active = pane && pane.dataset.mock === key;
      if (active && !reduceMotion()) {
        const pr = v.play();
        if (pr && typeof pr.catch === 'function') pr.catch(() => {});
      } else {
        v.pause();
        /* 元数据未载入时重置 currentTime 会中止正在进行的请求。 */
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
        const label = p.proof || p.name;
        if (u) {
          const a = linkEl(u, label, '');
          if (a) proof.appendChild(a); else proof.appendChild(document.createTextNode(label));
        } else {
          proof.appendChild(document.createTextNode(label));
        }
        proof.appendChild(el('span', '', '（' + (STATE_TEXT[p.status || 'live'] || '') + '）'));
      }
    }
    syncVideo(key);
  };

  rows.forEach((r) => r.addEventListener('click', () => show(r.dataset.mock)));
  rows.forEach((r, i) => r.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1
      : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = rows[(i + d + rows.length) % rows.length];
    next.focus();
    show(next.dataset.mock);
  }));

  const active = $('.artifact__pane.is-on');
  const first = rows[0];
  if (first) show(active ? active.dataset.mock : first.dataset.mock);

  document.addEventListener('visibilitychange', () => {
    const on = $('.artifact__pane.is-on');
    if (!on) return;
    syncVideo(document.hidden ? '' : on.dataset.mock);
  });
}

/* ---------- 面板零件 ---------- */
function actionsEl(p) {
  const box = el('div', 'actions');
  if (p.entry && p.source) {
    const a = el('a', 'btn btn--solid');
    a.href = '#preview';
    a.dataset.preview = p.id;
    a.appendChild(document.createTextNode('在线预览'));
    box.appendChild(a);
  }
  const live = linkEl(p.liveUrl, '打开站点', p.entry && p.source ? 'btn btn--line' : 'btn btn--solid');
  if (live) box.appendChild(live);
  if (p.qr && p.qr.src) {
    const q = el('button', 'btn btn--line');
    q.type = 'button';
    q.dataset.qr = p.qr.src;
    q.dataset.qrTitle = p.qr.title || (p.name + ' 扫码');
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

function itemSide(status, name, tagline, proof, proofUrl) {
  const side = el('div', 'item__side');
  const state = el('div', 'item__state');
  state.appendChild(el('span', 'chip ' + (STATE_CLASS[status] || 'chip--collection'), STATE_TEXT[status] || ''));
  side.appendChild(state);
  side.appendChild(el('h3', 'item__name', escapeHtml(name)));
  side.appendChild(el('p', 'item__tagline', escapeHtml(tagline || '')));
  if (proof) {
    const p = el('p', 'item__proof');
    const u = safeUrl(proofUrl);
    const a = u ? linkEl(u, proof, '') : null;
    if (a) p.appendChild(a); else p.appendChild(document.createTextNode(proof));
    side.appendChild(p);
  }
  return side;
}

/* 3D 的 Demo 档位：整宽、加深，和落幕查的媒体区同一量级 */
function demoSlotEl() {
  const fig = el('figure', 'demo-slot');
  fig.setAttribute('aria-label', '返航录 3D 版 Demo 档位预留');
  fig.appendChild(el('strong', '', 'Demo 档位预留'));
  fig.appendChild(el('span', '', '3D 版 Web 导出后接入'));
  fig.appendChild(el('small', '', 'Godot 垂直切片 · 暂无网页产物'));
  return fig;
}

/* returnlog 的 2.5D / 3D 从版本表拆成两条独立作品；
   数据仍来自 projects.json 的 versions，不新增项目、不改 3D 数据。 */
function featureItems(p) {
  const versions = p.versions || [];
  const v2d = versions.find((v) => v.name.includes('2.5D')) || versions[0];
  const v3d = versions.find((v) => v.status === 'local');
  const vAlt = versions.find((v) => v.status === 'collection');
  const items = [];

  if (v2d) {
    const a = el('article', 'item');
    a.id = 'case-returnlog';
    a.dataset.status = 'live';
    a.appendChild(itemSide('live', '新返航录 · 2.5D', p.tagline || '', v2d.proof || p.proof, v2d.proofUrl || p.proofUrl));
    const body = el('div', 'item__body');
    body.appendChild(el('p', 'item__lead', escapeHtml(p.lead || p.tagline || '')));
    const m = mediaEl(p); if (m) body.appendChild(m);
    const s = specEl(p.spec); if (s) body.appendChild(s);
    const acts = actionsEl(p); if (acts.childElementCount) body.appendChild(acts);
    const ls = linksEl(p); if (ls) body.appendChild(ls);
    if (vAlt) {
      const alt = el('p', 'item__alt');
      alt.appendChild(document.createTextNode('过渡式表单版（' + (vAlt.proof || 'V1preview') + '）：'));
      const altLink = linkEl(vAlt.url, '在合集里打开', '');
      if (altLink) alt.appendChild(altLink);
      body.appendChild(alt);
    }
    a.appendChild(body);
    items.push(a);
  }

  if (v3d) {
    const a = el('article', 'item');
    a.id = 'case-returnlog-3d';
    a.dataset.status = 'local';
    a.appendChild(itemSide('local', '新返航录 · 3D', '与 2.5D 共用规则口径，只搬数据与判定。', v3d.proof, v3d.proofUrl));
    const body = el('div', 'item__body');
    body.appendChild(el('p', 'item__lead', escapeHtml(v3d.desc || '')));
    body.appendChild(demoSlotEl());
    body.appendChild(el('p', 'item__note', 'Godot Web 导出后，这里会换成可玩的 3D Demo。'));
    a.appendChild(body);
    items.push(a);
  }
  return items;
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

function readoutEl(rows) {
  if (!rows || !rows.length) return null;
  const wrap = el('div', 'readout');
  rows.forEach((r) => {
    const row = el('div', 'readout__row');
    row.appendChild(el('span', 'readout__v', escapeHtml(r.value)));
    row.appendChild(el('span', 'readout__k', escapeHtml(r.cap)));
    wrap.appendChild(row);
  });
  return wrap;
}

function mediaEl(p) {
  const fig = el('figure', 'media');
  if (p.demo) {
    const src = safeUrl(p.demo.src);
    if (!src) return null;
    const v = el('video', '');
    v.src = src;
    const poster = safeUrl(p.demo.poster);
    if (poster) v.poster = poster;
    v.muted = true; v.loop = true; v.playsInline = true;
    v.preload = 'none';
    v.setAttribute('aria-label', p.name + ' 实机演示');
    v.dataset.demoVideo = '1';
    fig.appendChild(v);
    fig.appendChild(el('figcaption', '', escapeHtml(p.name + ' 实机演示，静音循环')));
    return fig;
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
    fig.appendChild(pic);
    fig.appendChild(el('figcaption', '', escapeHtml(p.name + ' 界面样张')));
    return fig;
  }
  return null;
}

/* ---------- 版式分发：每件作品按自己的证据类型排 ---------- */
function caseEl(p) {
  const a = el('article', 'item');
  a.id = 'case-' + p.id;
  a.dataset.status = p.status || 'live';
  a.appendChild(itemSide(p.status || 'live', p.name, p.tagline || '', p.proof, p.proofUrl));

  const body = el('div', 'item__body');
  body.appendChild(el('p', 'item__lead', escapeHtml(p.lead || p.tagline || '')));

  if (p.layout === 'split') {
    const grid = el('div', 'split');
    const m = mediaEl(p); if (m) grid.appendChild(m);
    const s = specEl(p.spec); if (s) grid.appendChild(s);
    if (grid.childElementCount) body.appendChild(grid);
  } else if (p.layout === 'data') {
    const wrap = el('div', 'data');
    const f = readoutEl(p.figures); if (f) wrap.appendChild(f);
    const m = mediaEl(p); if (m) wrap.appendChild(m);
    if (wrap.childElementCount) body.appendChild(wrap);
  }

  const acts = actionsEl(p); if (acts.childElementCount) body.appendChild(acts);
  const ls = linksEl(p); if (ls) body.appendChild(ls);
  a.appendChild(body);
  return a;
}

function noteEl(p) {
  const n = el('article', 'note');
  const side = el('div', 'note__side');
  side.appendChild(el('h3', '', escapeHtml(p.name)));
  if (p.proof) {
    const proof = el('p', '');
    const u = safeUrl(p.proofUrl);
    const link = u ? linkEl(u, p.proof, '') : null;
    if (link) proof.appendChild(link); else proof.appendChild(document.createTextNode(p.proof));
    side.appendChild(proof);
  }
  n.appendChild(side);

  const body = el('div', 'note__body');
  body.appendChild(el('p', '', escapeHtml(p.tagline || p.lead || '')));
  const acts = actionsEl(p); if (acts.childElementCount) body.appendChild(acts);
  const ls = linksEl(p); if (ls) body.appendChild(ls);
  n.appendChild(body);
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
    ordered.filter((p) => p.group !== 'process' && p.layout !== 'note')
      .forEach((p) => {
        if (p.layout === 'versions') {
          featureItems(p).forEach((item) => works.appendChild(item));
        } else {
          works.appendChild(caseEl(p));
        }
      });
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
}

/* ---------- 核对记录与验收章：数字全部从数据算 ---------- */
function renderRecord() {
  const mount = $('[data-record]');
  const full = PROJECTS.filter((p) => p.group !== 'process' && p.layout !== 'note');
  const live = full.filter((p) => (p.status || 'live') === 'live').length;
  const games = PROJECTS.filter((p) => p.group === 'play' && p.countsAsGame).length;
  const slots = PROJECTS.reduce((n, p) => n + (p.versions || []).filter((v) => v.status === 'local').length, 0);

  $$('[data-count="live"]').forEach((n) => setText(n, String(live)));
  $$('[data-count="pending"]').forEach((n) => setText(n, String(slots)));

  if (!mount) return;
  mount.innerHTML = '';
  const rows = [
    { v: live, k: '在线作品', label: '本页检验项', url: '#work' },
    { v: games, k: '可玩网页游戏', label: '各自独立域名', url: '#work' },
    { v: slots, k: '预留槽位', label: '返航录 3D 版', url: '#case-returnlog-3d' },
    { v: 0, k: '运行时外部依赖', label: '本站源码', url: 'https://github.com/hxj-2888/portfolio' },
  ];
  rows.forEach((r) => {
    const row = el('div', 'readout__row');
    row.appendChild(el('span', 'readout__v', String(r.v)));
    const k = el('span', 'readout__k');
    k.appendChild(document.createTextNode(r.k + ' '));
    const a = linkEl(r.url, r.label, '');
    if (a) k.appendChild(a);
    row.appendChild(k);
    mount.appendChild(row);
  });
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

/* ---------- 面板里的演示视频：进视口才播，离开即停 ---------- */
function bindDemoVideos() {
  const vids = $$('video[data-demo-video]');
  if (!vids.length) return;
  const play = (v) => {
    v.preload = 'auto';
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  };
  if (reduceMotion()) return;
  if (!('IntersectionObserver' in window)) { vids.forEach(play); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { e.isIntersecting ? play(e.target) : e.target.pause(); });
  }, { threshold: 0.35 });
  vids.forEach((v) => io.observe(v));
}

/* ---------- 数据加载：内联优先，fetch 只兜底 ---------- */
function applyData(data) {
  PROJECTS = (data.projects || []).slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  renderSampleTabs();
  renderCases();
  renderRecord();
  bindStage();
  bindDemoVideos();
}

function readInlineData() {
  const node = document.getElementById('projects-data');
  if (!node) return null;
  try {
    return JSON.parse(node.textContent);
  } catch (err) {
    console.warn('[site] projects-data 内联块解析失败', err);
    return null;
  }
}

function fetchProjects() {
  return fetch('projects.json', { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error('projects.json ' + r.status);
    return r.json();
  });
}

function fetchWithRetry(attempts = 2) {
  return fetchProjects().catch((err) => {
    if (attempts <= 1) throw err;
    return new Promise((resolve) => setTimeout(resolve, 600)).then(() => fetchWithRetry(attempts - 1));
  });
}

function showDataError(err) {
  console.error('[site] 作品数据加载失败：', err);
  const mount = $('[data-cases]:not([data-cases="process"])');
  if (!mount) return;
  mount.innerHTML = '';
  const p = el('p', 'data-error');
  p.appendChild(document.createTextNode('作品数据没有加载出来。检查网络后重试。'));
  const b = el('button');
  b.type = 'button';
  b.appendChild(document.createTextNode('重新加载'));
  b.addEventListener('click', () => location.reload());
  p.appendChild(b);
  mount.appendChild(p);
}

bindNav();
const inlineData = readInlineData();
if (inlineData) applyData(inlineData);
else fetchWithRetry(2).then(applyData).catch(showDataError);
