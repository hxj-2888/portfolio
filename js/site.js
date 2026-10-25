/* ============================================================
   site.js — 作品集交互（零依赖，数据驱动）
   数据源：projects.json（唯一真相）。卡片、合集横幅与弹窗都从这里渲染。
   约定：不写内联 onclick；所有可点元素都是 <a>/<button>，键盘可用。
   2026-10-25 UI 改版：
     · 游戏合集卡降级为一条横幅，排在其他作品卡上方；
     · 卡片主次动作拆开（实心「在线预览」+ 次要「打开站点」）；
     · 导航当前分区高亮、滚动淡入、数据带数字递增、首屏展示台切换；
     · 动效统一走 prefers-reduced-motion 开关。
   ============================================================ */

/* ---------- 内联图标（线性 SVG，stroke 1.6，24 网格） ---------- */
const ICON = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>',
  github:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.2-1.5 6.2-6.8a5.3 5.3 0 0 0-1.4-3.7 4.9 4.9 0 0 0-.1-3.7s-1.1-.3-3.7 1.4a12.7 12.7 0 0 0-6.6 0C6 4.6 4.9 4.9 4.9 4.9a4.9 4.9 0 0 0-.1 3.7A5.3 5.3 0 0 0 3.4 12.3c0 5.3 3.2 6.5 6.2 6.8a3.4 3.4 0 0 0-.9 2.6V21"/></svg>',
  doc:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  play:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>'
};

/* ---------- 数据加载 ---------- */
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
const iconFor = (name) => ICON[name] || ICON.globe;

/* 卡片动作：一个实心主按钮 + 一个次要文字链 */
function buildActions(p) {
  const actions = el('div', 'card__actions');
  const canPreview = Boolean(p.entry && p.source);

  if (canPreview) {
    const cta = el('a', 'card__cta');
    cta.href = '#preview';
    cta.dataset.preview = p.id;
    cta.appendChild(document.createTextNode('在线预览'));
    cta.insertAdjacentHTML('beforeend', ICON.play);
    actions.appendChild(cta);
  }
  if (p.liveUrl) {
    const live = el('a', canPreview ? 'card__link' : 'card__cta');
    live.href = p.liveUrl;
    live.target = '_blank';
    live.rel = 'noopener';
    live.appendChild(document.createTextNode('打开站点'));
    live.insertAdjacentHTML('beforeend', ICON.arrow);
    actions.appendChild(live);
  }
  return actions;
}

/* 资源行：GitHub / Gitee / 附件 / APK */
function buildLinks(p) {
  const links = el('div', 'card__links');
  (p.links || []).forEach((l) => {
    const a = el('a', '');
    a.href = l.url;
    if (!l.url.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; }
    a.innerHTML = iconFor(l.icon);
    a.appendChild(document.createTextNode(' ' + l.label));
    links.appendChild(a);
  });
  return links.childElementCount ? links : null;
}

function buildTags(p) {
  const tags = el('div', 'card__tags');
  (p.tags || []).slice(0, 3).forEach((t) => tags.appendChild(el('span', 'badge', escapeHtml(t))));
  return tags;
}

/* 普通作品卡：有缩略图才建图区；纯文档类走紧凑信息块 */
function renderCard(p) {
  const article = el('article', 'card');
  if (p.wide) article.classList.add('card--wide');

  if (p.thumbnail) {
    const media = el('div', 'card__media');
    if (p.id) media.classList.add('card__media--' + p.id);
    const img = el('img');
    img.src = p.thumbnail;
    img.alt = p.name + ' 截图';
    img.loading = 'lazy';
    img.width = 960; img.height = 600;
    media.appendChild(img);
    media.appendChild(el('span', 'card__accent'));
    article.appendChild(media);
  } else {
    article.classList.add('card--note');
    article.appendChild(el('span', 'card__accent'));
  }

  const body = el('div', 'card__body');
  const eyebrow = el('p', 'card__eyebrow');
  if (!p.thumbnail) eyebrow.innerHTML = iconFor(p.icon || (p.type === 'doc' ? 'doc' : 'globe'));
  eyebrow.appendChild(document.createTextNode((p.thumbnail ? '' : ' ') + (p.kicker || p.category || '')));
  body.appendChild(eyebrow);
  body.appendChild(el('h3', 'card__title', escapeHtml(p.name)));
  if (p.tagline) body.appendChild(el('p', 'card__line', escapeHtml(p.tagline)));
  body.appendChild(buildTags(p));
  body.appendChild(buildActions(p));
  const links = buildLinks(p);
  if (links) body.appendChild(links);

  article.appendChild(body);
  return article;
}

/* 游戏合集：降级成一条横幅（内容不变，层级变了） */
function renderBand(p) {
  const band = el('article', 'band');
  const title = el('div', '');
  title.appendChild(el('p', 'card__eyebrow', escapeHtml(p.kicker || '游戏合集')));
  title.appendChild(el('h3', 'band__title', escapeHtml(p.name)));

  const mid = el('div', '');
  mid.appendChild(el('p', 'band__desc', escapeHtml(p.tagline || '')));
  const tags = el('div', 'band__tags');
  (p.tags || []).slice(0, 3).forEach((t) => tags.appendChild(el('span', 'badge', escapeHtml(t))));
  mid.appendChild(tags);

  const acts = buildActions(p);
  acts.classList.add('band__acts');

  band.appendChild(title);
  band.appendChild(mid);
  band.appendChild(acts);
  return band;
}

function renderProjects() {
  const bandMount = $('#bandMount');
  const band = PROJECTS.find((p) => p.band === true);
  const cards = PROJECTS.filter((p) => p.band !== true);
  if (bandMount) {
    bandMount.innerHTML = '';
    if (band) bandMount.appendChild(renderBand(band));
    else bandMount.remove();
  }
  $$('[data-group]').forEach((mount) => {
    const group = mount.dataset.group;
    cards.filter((p) => p.group === group).forEach((p) => mount.appendChild(renderCard(p)));
  });

  // 数据带里「可玩网页游戏」跟着 countsAsGame 走，避免数字与内容漂移
  const gameCount = PROJECTS.filter((p) => p.group === 'play' && p.countsAsGame).length;
  $$('[data-count="games"]').forEach((n) => setText(n, String(gameCount)));
}

/* ---------- 预览弹窗 ---------- */
function openPreview(id) {
  const p = PROJECTS.find((x) => x.id === id);
  if (!p || !p.entry) return;
  const modal = $('#previewModal');
  setText($('#pmTitle'), p.name);
  setText($('#pmSub'), (p.tags || []).join(' · '));
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

/* 事件委托：弹窗、预览链接、二维码入口、复制按钮都挂在 document 上，
   渲染出来的卡片无需逐个绑事件 */
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
  m.addEventListener('click', (e) => { if (e.target === m) { m.querySelector('[data-close]')?.click(); } });
});

/* ---------- 复制邮箱 ---------- */
async function copyMail(btn) {
  const text = btn.dataset.copyMail || '';
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = '已复制';
    setTimeout(() => { btn.textContent = '复制'; }, 1500);
  } catch (_) {
    btn.textContent = '复制失败';
    setTimeout(() => { btn.textContent = '复制'; }, 1500);
  }
}

/* ---------- 首屏展示台：三张截图按标签切换 ---------- */
const STAGE_CAPS = {
  'space-kill': '返航录 · v1preview1.0 · 15 人三阵营，空席位由 AI 托管',
  'ping-pong-duel': '乒乓对决 · ITTF 标准球台的真实物理乒乓球，人机、双人与房间码联机。',
  'delta-force': '落幕查 · 三角洲行动变卖物的实时价格查询，带 30 天走势。'
};
function bindStage() {
  const tabs = $$('.stage__tabs [data-mock]');
  if (!tabs.length) return;
  const show = (key) => {
    $$('.stage__pane').forEach((p) => p.classList.toggle('is-on', p.dataset.mock === key));
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mock === key)));
    const cap = $('[data-stage-caption]');
    if (cap && STAGE_CAPS[key]) setText(cap, STAGE_CAPS[key]);
  };
  tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.mock)));
}

/* ---------- 导航：滚动毛玻璃 + 当前分区高亮 ---------- */
function bindNav() {
  const head = $('#siteHead');
  if (head) {
    const onScroll = () => head.setAttribute('data-scrolled', String(window.scrollY > 20));
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
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

/* ---------- 滚动淡入 + 数字递增（尊重 reduced-motion） ---------- */
function countUp(node, to, suffix = '') {
  if (reduceMotion() || to < 2) { setText(node, to.toLocaleString('en-US') + suffix); return; }
  const t0 = performance.now(), dur = 1200;
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    setText(node, Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString('en-US') + suffix);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function bindReveal() {
  const targets = $$('.rv');
  const counters = $$('[data-to]');
  if (!('IntersectionObserver' in window) || reduceMotion()) {
    targets.forEach((t) => t.classList.add('is-in'));
    counters.forEach((n) => countUp(n, Number(n.dataset.to)));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
      $$('[data-to]', entry.target).forEach((n) => {
        if (n.dataset.counted === '1') return;
        n.dataset.counted = '1';
        countUp(n, Number(n.dataset.to));
      });
    });
  }, { threshold: 0.15 });
  targets.forEach((t) => io.observe(t));
}

/* ---------- 启动 ---------- */
bindStage();
bindNav();
fetch('projects.json', { cache: 'no-cache' })
  .then((r) => { if (!r.ok) throw new Error('projects.json ' + r.status); return r.json(); })
  .then((data) => {
    // 排序：置顶优先，其次按 order 升序
    PROJECTS = (data.projects || []).slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    renderProjects();
    bindReveal();
  })
  .catch((err) => {
    console.error('[site] 项目数据加载失败：', err);
    $$('[data-group]').forEach((m) => {
      m.appendChild(el('p', 'card__line', '项目数据加载失败，请刷新重试。'));
    });
    bindReveal();
  });
