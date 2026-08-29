/* ============================================
   作品集 | Portfolio — 主逻辑
   ============================================ */

(function () {
  'use strict';

  // ==================== 状态 ====================
  let projects = [];
  let activeTag = null;
  let searchQuery = '';

  // ==================== DOM 引用 ====================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const grid = $('#projectsGrid');
  const emptyState = $('#emptyState');
  const statCount = $('#statCount');
  const filterTags = $('#filterTags');
  const searchInput = $('#searchInput');
  const searchClear = $('#searchClear');
  const searchBox = $('#searchBox');
  const modalOverlay = $('#modalOverlay');
  const modal = $('#modal');
  const modalTitle = $('#modalTitle');
  const modalTags = $('#modalTags');
  const modalIframe = $('#modalIframe');
  const modalLoader = $('#modalLoader');
  const modalError = $('#modalError');
  const modalErrorMsg = $('#modalErrorMsg');
  const btnOpenNew = $('#btnOpenNew');
  const btnModalClose = $('#btnModalClose');

  // ==================== 加载项目数据 ====================
  async function loadProjects() {
    try {
      const resp = await fetch('projects.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      projects = data.projects || [];
      if (!projects.length) {
        // 如果没有配置项目，展示默认空白
        statCount.textContent = '0';
        return;
      }
      init();
    } catch (err) {
      console.warn('无法加载 projects.json，使用内置示例数据', err);
      // 降级：使用内嵌示例项目
      projects = getFallbackProjects();
      init();
    }
  }

  /** 内嵌示例项目（当 projects.json 不可用时使用） */
  function getFallbackProjects() {
    return [
      {
      id: 'delta-force',
      name: '落幕查 - 变卖物价格查询',
      description: '落幕查（三角洲行动变卖物实时价格查询工具）：分类浏览、搜索、收藏、价格异动与 30 天历史走势；安卓 APK（v3.0）扫码下载。',
        tags: ['PWA', 'API', '价格查询', 'IndexedDB'],
        thumbnail: 'projects/delta-force/delta-force-logo.webp',
        entry: 'index.html',
        type: 'web',
        mobile: true,
      },
      {
        id: 'portfolio-source',
        name: '个人作品集 · 本站',
        description: '本站由这些文件组成：实时预览 + 源码展示，自己展示自己。',
        tags: ['HTML', 'CSS', 'JavaScript', '自我展示'],
        icon: '🖥️',
        entry: 'index.html',
        type: 'web',
      },
    ];
  }

  // ==================== 初始化 ====================
  function init() {
    statCount.textContent = projects.length;
    renderFilterTags();
    renderCards();
    bindEvents();
    createBgParticles();
  }

  // ==================== 渲染筛选标签 ====================
  function renderFilterTags() {
    // 收集所有标签
    const tagMap = new Map();
    projects.forEach((p) => {
      (p.tags || []).forEach((t) => {
        tagMap.set(t, (tagMap.get(t) || 0) + 1);
      });
    });

    // 按数量降序排列
    const sorted = [...tagMap.entries()].sort((a, b) => b[1] - a[1]);

    let html = '<span class="tag';
    if (activeTag === null) html += ' active';
    html += `" data-tag="">全部<span class="tag-count">${projects.length}</span></span>`;

    sorted.forEach(([tag, count]) => {
      html += '<span class="tag';
      if (activeTag === tag) html += ' active';
      html += `" data-tag="${escapeAttr(tag)}">${escapeHtml(tag)}<span class="tag-count">${count}</span></span>`;
    });

    filterTags.innerHTML = html;
  }

  // ==================== 渲染项目卡片 ====================
  function renderCards() {
    const filtered = getFilteredProjects();

    if (filtered.length === 0) {
      grid.innerHTML = '';
      grid.style.display = 'none';
      emptyState.style.display = '';
      return;
    }

    grid.style.display = '';
    emptyState.style.display = 'none';

    grid.innerHTML = filtered.map((p) => {
      const iconHtml = p.icon
        ? `<div class="card-thumb-placeholder">${escapeHtml(p.icon)}</div>`
        : (p.thumbnail
          ? `<img class="card-thumb" src="${escapeAttr(p.thumbnail)}" alt="${escapeAttr(p.name)}" loading="lazy">`
          : `<div class="card-thumb-placeholder">📁</div>`);

      const typeBadge = p.type ? `<span class="card-type-badge">${escapeHtml(p.type)}</span>` : '';

      return `
        <article class="project-card" data-id="${escapeAttr(p.id)}">
          <div class="card-preview">
            ${iconHtml}
            ${typeBadge}
            <div class="card-overlay">
              <button type="button" class="card-overlay-btn" aria-label="预览 ${escapeAttr(p.name)}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                预览项目
              </button>
            </div>
          </div>
          <div class="card-body">
            <h3 class="card-title">${escapeHtml(p.name)}</h3>
            <p class="card-desc">${escapeHtml(p.description || '')}</p>
            <div class="card-tags">
              ${(p.tags || []).map((t) => `<span class="card-tag">${escapeHtml(t)}</span>`).join('')}
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  /** 根据当前搜索和标签过滤 */
  function getFilteredProjects() {
    return projects.filter((p) => {
      // 标签过滤
      if (activeTag && !(p.tags || []).includes(activeTag)) return false;
      // 搜索过滤
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const haystack = [p.name, p.description, ...(p.tags || [])].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  // ==================== 事件绑定 ====================
  function bindEvents() {
    // 搜索
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value.trim();
      searchClear.style.display = searchQuery ? '' : 'none';
      renderCards();
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      searchClear.style.display = 'none';
      renderCards();
      searchInput.focus();
    });

    // 键盘快捷键：Ctrl+K / Cmd+K 聚焦搜索
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
      // ESC 关闭 modal
      if (e.key === 'Escape' && modalOverlay.classList.contains('open')) {
        closeModal();
      }
    });

    // 标签筛选
    filterTags.addEventListener('click', (e) => {
      const tagEl = e.target.closest('.tag');
      if (!tagEl) return;
      activeTag = tagEl.dataset.tag || null;
      renderFilterTags();
      renderCards();
    });

    // 卡片点击 → 打开预览
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.project-card');
      if (!card) return;
      const id = card.dataset.id;
      const project = projects.find((p) => p.id === id);
      if (project) openPreview(project);
    });

    // Modal 关闭
    btnModalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    // 空状态清除筛选按钮
    $('#btnClearFilter').addEventListener('click', () => {
      activeTag = null;
      searchQuery = '';
      searchInput.value = '';
      searchClear.style.display = 'none';
      renderFilterTags();
      renderCards();
    });
  }

  // ==================== 预览 Modal ====================
  function openPreview(project) {
    const projectPath = project.entry
      ? `projects/${project.id}/${project.entry}`
      : `projects/${project.id}/`;

    // 设置标题和标签
    modalTitle.textContent = project.name;
    modalTags.innerHTML = (project.tags || []).map((t) => `<span class="card-tag">${escapeHtml(t)}</span>`).join('');
    // 优先打开线上真实地址（如有），否则打开本地文件
    btnOpenNew.href = project.liveUrl || projectPath;
    // 手机项目：窄屏手机框预览
    modal.classList.toggle('modal-mobile', !!project.mobile);

    // 重置状态
    modalIframe.classList.remove('loaded');
    modalIframe.style.display = '';
    modalLoader.style.display = '';
    modalError.style.display = 'none';

    // 设置 iframe src
    modalIframe.src = projectPath;

    // 监听 iframe 加载
    modalIframe.onload = () => {
      modalIframe.classList.add('loaded');
      modalLoader.style.display = 'none';
    };

    modalIframe.onerror = () => {
      showModalError('项目文件加载失败，请检查项目是否已构建。');
    };

    // 超时处理（8 秒）
    const timeout = setTimeout(() => {
      if (!modalIframe.classList.contains('loaded')) {
        modalLoader.style.display = 'none';
        // 不强制显示错误，可能只是慢
      }
    }, 8000);

    modalIframe.dataset.timeout = timeout;

    // 数据依赖型项目：加载 10 秒后页面仍处于加载态 → 给出明确提示
    const failTimer = setTimeout(() => {
      if (!modalOverlay.classList.contains('open')) return;
      let stuck = false;
      try {
        const doc = modalIframe.contentDocument;
        const loadingEl = doc && doc.getElementById && doc.getElementById('loadingScreen');
        if (loadingEl) {
          stuck = !loadingEl.classList.contains('removed');
        } else {
          stuck = !modalIframe.classList.contains('loaded');
        }
      } catch (e) {
        stuck = true;
      }
      if (stuck) {
        showModalError('预览数据加载超时：本项目依赖数据接口，需将作品集部署到 Cloudflare Pages 并配置 API_TOKEN 后显示实时数据，也可点击下方按钮打开线上版本。');
      }
    }, 10000);
    modalIframe.dataset.failTimer = failTimer;

    // 打开
    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modalOverlay.classList.remove('open');
    document.body.style.overflow = '';

    // 清理
    clearTimeout(parseInt(modalIframe.dataset.timeout));
    clearTimeout(parseInt(modalIframe.dataset.failTimer));
    modalIframe.src = 'about:blank';
    modalIframe.classList.remove('loaded');
  }

  function showModalError(msg) {
    modalLoader.style.display = 'none';
    modalError.style.display = '';
    modalErrorMsg.textContent = msg;
    modalIframe.style.display = 'none';
  }

  // ==================== 主题切换 ====================
  function initTheme() {
    const saved = localStorage.getItem('portfolio-theme');
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      $('#icon-sun').style.display = 'none';
      $('#icon-moon').style.display = '';
    }
  }

  $('#btnTheme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next || '');
    localStorage.setItem('portfolio-theme', next === 'dark' ? 'dark' : 'light');

    $('#icon-sun').style.display = next === 'dark' ? '' : 'none';
    $('#icon-moon').style.display = next === 'light' ? '' : 'none';
  });

  // ==================== 背景粒子（装饰） ====================
  function createBgParticles() {
    const canvas = document.createElement('canvas');
    canvas.className = 'bg-particles';
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');

    let w, h;
    const particles = [];
    const count = 50;
    const maxDistance = 120;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r: Math.random() * 1.5 + 0.5,
      });
    }

    function animate() {
      ctx.clearRect(0, 0, w, h);

      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const particleColor = isLight ? '160, 160, 200' : '100, 100, 160';
      const lineColor = isLight ? '180, 180, 210' : '80, 80, 130';

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particleColor}, 0.5)`;
        ctx.fill();
      });

      // 连线
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDistance) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${lineColor}, ${0.15 * (1 - dist / maxDistance)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(animate);
    }

    animate();
  }

  // ==================== 工具函数 ====================
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ==================== 启动 ====================
  initTheme();
  loadProjects();
})();
