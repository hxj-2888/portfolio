<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>作品集 | Portfolio</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>">
</head>
<body>

  <!-- 导航栏 -->
  <header class="header">
    <div class="header-inner">
      <a href="/" class="logo">⚡ Portfolio</a>
      <div class="header-right">
        <button class="btn-icon" id="btnSearch" title="搜索" aria-label="搜索">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
        <button class="btn-icon" id="btnTheme" title="切换主题" aria-label="切换主题">
          <svg id="icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg id="icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
      </div>
    </div>
  </header>

  <!-- 主内容区 -->
  <main class="main">

    <!-- 个人信息 -->
    <section class="hero">
      <div class="hero-avatar">
        <div class="avatar-placeholder">👨‍💻</div>
      </div>
      <h1 class="hero-title">个人作品集</h1>
      <p class="hero-subtitle">
        这里存放着我的项目作品，每个项目都可以直接预览实际效果。
      </p>
      <div class="hero-stats" id="statsBar">
        <span class="stat"><strong id="statCount">0</strong> 个项目</span>
      </div>
    </section>

    <!-- 搜索 & 筛选 -->
    <section class="toolbar">
      <div class="search-box" id="searchBox">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="searchInput" placeholder="搜索项目..." autocomplete="off">
        <button class="search-clear" id="searchClear" style="display:none" aria-label="清除搜索">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="filter-tags" id="filterTags">
        <!-- JS 动态生成 -->
      </div>
    </section>

    <!-- 项目卡片墙 -->
    <section class="projects-grid" id="projectsGrid">
      <!-- JS 动态生成 -->
    </section>

    <!-- 空状态 -->
    <div class="empty-state" id="emptyState" style="display:none">
      <div class="empty-icon">📭</div>
      <h3>没有找到匹配的项目</h3>
      <p>试试换一个关键词或清除筛选条件</p>
      <button class="btn btn-outline" id="btnClearFilter">清除筛选</button>
    </div>

  </main>

  <!-- 项目预览 Modal -->
  <div class="modal-overlay" id="modalOverlay">
    <div class="modal" id="modal">
      <div class="modal-header">
        <div class="modal-title-group">
          <h2 class="modal-title" id="modalTitle"></h2>
          <span class="modal-tags" id="modalTags"></span>
        </div>
        <div class="modal-actions">
          <a class="btn btn-outline btn-sm" id="btnOpenNew" target="_blank" rel="noopener">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            新窗口
          </a>
          <button class="btn-icon modal-close" id="btnModalClose" aria-label="关闭">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="modal-body">
        <div class="modal-loader" id="modalLoader">
          <div class="spinner"></div>
          <span>加载项目中...</span>
        </div>
        <div class="modal-error" id="modalError" style="display:none">
          <span class="error-icon">⚠️</span>
          <p id="modalErrorMsg">预览加载失败</p>
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('btnOpenNew').click()">
            在新窗口打开
          </button>
        </div>
        <iframe id="modalIframe" class="modal-iframe" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" loading="lazy" title="项目预览"></iframe>
      </div>
    </div>
  </div>

  <footer class="footer">
    <p>Powered by <a href="https://pages.cloudflare.com" target="_blank" rel="noopener">Cloudflare Pages</a></p>
  </footer>

  <script src="js/main.js"></script>
</body>
</html>
