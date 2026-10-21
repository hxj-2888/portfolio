/* ============================================================
   site.js — 作品集交互（零依赖，数据驱动）
   数据源：projects.json（唯一真相）。卡片与弹窗都从这里渲染。
   约定：不写内联 onclick；所有可点元素都是 <a>/<button>，键盘可用。
   ============================================================ */

/* ---------- 内联图标（线性 SVG，stroke 1.5，24 网格） ---------- */
const ICON = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>',
  down:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>',
  github:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.2-1.5 6.2-6.8a5.3 5.3 0 0 0-1.4-3.7 4.9 4.9 0 0 0-.1-3.7s-1.1-.3-3.7 1.4a12.7 12.7 0 0 0-6.6 0C6 4.6 4.9 4.9 4.9 4.9a4.9 4.9 0 0 0-.1 3.7A5.3 5.3 0 0 0 3.4 12.3c0 5.3 3.2 6.5 6.2 6.8a3.4 3.4 0 0 0-.9 2.6V21"/></svg>',
  play:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5.5v13l11-6.5-11-6.5Z"/></svg>',
  doc:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  qr:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM20 14v2M14 20h2M20 18v3h-3"/></svg>',
  mail:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/></svg>'
};

/* ---------- 数据加载 ---------- */
let PROJECTS = [];
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
};
const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/* 卡片：L1 只放 类别/标题/一句话/标签/主链接 */
function renderCard(p) {
  const article = el('article', 'card');
  if (p.wide) article.classList.add('card--wide');
  const canPreview = Boolean(p.entry && p.source);

  /* 有缩略图才建图区；纯文档/过程类条目不再占一块空白图区（否则卡片上半截全是空的） */
  const hasMedia = Boolean(p.thumbnail);
  if (hasMedia) {
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
  if (!hasMedia) eyebrow.innerHTML = ICON[p.icon || (p.type === 'doc' ? 'doc' : 'globe')];
  eyebrow.appendChild(document.createTextNode((hasMedia ? '' : ' ') + (p.kicker || p.category || '')));
  body.appendChild(eyebrow);
  body.appendChild(el('h3', 'card__title', escapeHtml(p.name)));
  if (p.tagline) body.appendChild(el('p', 'card__line', escapeHtml(p.tagline)));

  const tags = el('div', 'card__tags');
  (p.tags || []).slice(0, 3).forEach((t) => tags.appendChild(el('span', 'badge', escapeHtml(t))));
  body.appendChild(tags);

  const actions = el('div', 'card__actions');
  if (canPreview) {
    const open = el('a', 'card__link');
    open.href = '#preview';
    open.appendChild(document.createTextNode('在线预览'));
    open.insertAdjacentHTML('beforeend', ICON.arrow);
    open.addEventListener('click', (e) => { e.preventDefault(); openPreview(p.id); });
    actions.appendChild(open);
  }
  if (p.liveUrl) {
    const live = el('a', 'card__link');
    live.href = p.liveUrl; live.target = '_blank'; live.rel = 'noopener';
    live.appendChild(document.createTextNode('打开站点'));
    live.insertAdjacentHTML('beforeend', ICON.arrow);
    actions.appendChild(live);
  }
  body.appendChild(actions);

  // 资源行：GitHub / Gitee / 附件 / APK
  const links = el('div', 'card__links');
  (p.links || []).forEach((l) => {
    const a = el('a', '');
    a.href = l.url;
    if (!l.url.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; }
    a.innerHTML = ICON[l.icon === 'github' ? 'github' : (l.icon === 'doc' ? 'doc' : 'globe')];
    a.appendChild(document.createTextNode(' ' + l.label));
    links.appendChild(a);
  });
  if (links.childElementCount) body.appendChild(links);

  article.appendChild(body);
  return article;
}

function renderProjects() {
  document.querySelectorAll('[data-group]').forEach((mount) => {
    const group = mount.dataset.group;
    PROJECTS.filter((p) => p.group === group).forEach((p) => mount.appendChild(renderCard(p)));
  });
  // 数据带上的数字与项目数保持一致，避免“写死的数字”与内容漂移
  const gameCount = PROJECTS.filter((p) => p.group === 'play' && p.countsAsGame).length;
  document.querySelectorAll('[data-count="games"]').forEach((n) => { n.textContent = String(gameCount); });
}

/* ---------- 预览弹窗 ---------- */
function openPreview(id) {
  const p = PROJECTS.find((x) => x.id === id);
  if (!p || !p.entry) return;
  const modal = $('#previewModal');
  $('#pmTitle').textContent = p.name;
  $('#pmSub').textContent = (p.tags || []).join(' · ');
  $('#pmFrame').src = 'projects/' + p.id + '/' + p.entry;
  const live = $('#pmLive');
  if (p.liveUrl) { live.href = p.liveUrl; live.hidden = false; } else { live.hidden = true; }
  modal.dataset.open = 'true';
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  $('#pmFrame').focus?.();
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
  $('#qrTitle').textContent = title;
  $('#qrImg').src = src;
  modal.dataset.open = 'true';
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
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
  if (closer) { e.preventDefault(); closer.dataset.close === 'qr' ? closeQr() : closePreview(); }
});
document.querySelectorAll('.modal').forEach((m) => {
  m.addEventListener('click', (e) => { if (e.target === m) { m.querySelector('[data-close]')?.click(); } });
});
document.querySelectorAll('[data-qr]').forEach((btn) => {
  btn.addEventListener('click', (e) => { e.preventDefault(); showQr(btn.dataset.qr, btn.dataset.qrTitle || ''); });
});

/* ---------- 启动 ---------- */
fetch('projects.json', { cache: 'no-cache' })
  .then((r) => { if (!r.ok) throw new Error('projects.json ' + r.status); return r.json(); })
  .then((data) => {
    // 排序：置顶优先，其次按 order 升序
    PROJECTS = (data.projects || []).slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    renderProjects();
  })
  .catch((err) => {
    console.error('[site] 项目数据加载失败：', err);
    document.querySelectorAll('[data-group]').forEach((m) => {
      m.appendChild(el('p', 'card__line', '项目数据加载失败，请刷新重试。'));
    });
  });
