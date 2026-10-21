# 游戏包方案 · 大厅 + 双游戏（乒乓对决 / 返航录）

> 状态：**方案稿（待确认后执行）** · 起草 2026-10-21 · 不涉及任何代码改动
> 目标：把「乒乓对决」（含联机 + Android）与「返航录」（含附件站 PDF）合成为一个**可分发、可展示、可维护**的游戏包，接入个人作品集。

---

## 0. 结论先行

- **形态**：**游戏大厅（Launcher）+ 两个各自独立的游戏子包**。大厅负责统一的视觉、导航、版本信息、下载入口和「返回大厅」；两个游戏**代码零改动**（最多加一层外壳），避免动到你仓库里的红线（双端镜像、引擎 7 对字节一致、SW 缓存键）。
- **落地位置**：作品集仓库内新建 `projects/game-arcade/`，由 `sync.json` 新增一个 `arcade` 段，从两个源仓库**按白名单同步**，和现有 `delta-force` 完全同一套机制。
- **两种产物，一套源码**：
  1. `portfolio/projects/game-arcade/` —— 内嵌在作品集 iframe 里预览（**单机玩法可用**，联机不可用，见 §6）；
  2. `arcade.pages.dev` —— 独立域名整包部署（**联机、PWA、APK 下载全部可用**）。
- **风险最高的三件事**：① Service Worker 在子目录下越界；② 乒乓的 WebSocket 房间服务在 iframe 里连不上；③ 两个游戏都用 `localStorage`，键名冲突。方案里逐条给了对策（§6）。

---

## 1. 现状勘察（已核对磁盘）

| 项目 | 实际路径 | 入口 | 依赖 | 部署 |
|---|---|---|---|---|
| 乒乓对决 v3.2.1 | `Desktop\乒乓对决_合并\public` | `index.html`（43.9 KB）+ `_worker.js`（WS→DO） | 零依赖；SW `sw.js`（缓存名绑版本）；`server.js` 本地 WS | `ping-pong-duel.pages.dev` + DO Worker |
| 返航录 V1preview | `Desktop\太空杀游戏-完整版` | `index.html`（21.3 KB）+ `server/server.js` | 零依赖；`npm start` 自带静态与 WS（8766） | `space-kill-web.pages.dev`；附件站 `space-kill.pages.dev` |
| 作品集 | `Desktop\portfolio` | `index.html`（Tailwind vendor 410 KB + iconify） | 纯静态 + Pages Functions（`/api`，D1/KV） | `portfolio.pages.dev` |

**关键既有机制（必须复用，不要新造）**

1. `sync.json` + `sync-projects.js`：白名单复制 + **补丁规则** + `neverCopy` 拦截 + `--dry-run` + 幂等。现有 `delta-force` 段已经把「根绝对路径 → 相对路径」「iframe 守卫」这类适配写成了可复用规则。
2. `build-collect.js` + `projects.json`：收集产物、供首页卡片使用。
3. `修改记录.md` + 各仓库 `AGENTS.md`：版本记录规范（见 §8）。

**注意**：`space-kill-3.0/` 是 2026-10-07 起**已退役的过期克隆**（`sync.json` 已写明 remote 404），**不要**再从它取源；源应为 `太空杀游戏-完整版`。

---

## 2. 目标产物形态

```
game-arcade/                    ← 部署到 arcade.pages.dev、也是作品集内嵌副本
├─ index.html                   ← 大厅（唯一手写页）
├─ arcade.css / arcade.js       ← 大厅样式与逻辑（约 200 行内）
├─ hub.json                     ← 游戏清单（id/名称/截图/版本/标签/可用能力）
├─ assets/
│  ├─ icon-arcade.png
│  ├─ thumb-ping-pong.webp       ← 先复用作品集现有截图，AI 重绘随后
│  └─ thumb-space-kill.webp
├─ games/ping-pong/             ← 乒乓 public/ 白名单副本（同步）
├─ games/space-kill/            ← 返航录白名单副本（同步）
├─ _headers                     ← 安全头（CSP 见 §6.5）
└─ ARCADE-CHANGELOG.md          ← 大厅版本记录
```

大厅信息架构（一屏）：

```
┌──────────────────────────────────────────────┐
│ ARCADE  ·  何向杰                          ⓘ │
│ 两个可玩网页游戏：乒乓对决 / 返航录            │
├───────────────┬──────────────────────────────┤
│ [乒乓对决大卡] │ [返航录大卡]                 │
│ 缩略图 / 版本   │ 缩略图 / 规则口径            │
│ ▶ 开始   ↗独立  │ ▶ 开始   📱APK   📄附件      │
├───────────────┴──────────────────────────────┤
│ 最近玩过 / 本地存档统计 / 更新日志             │
└──────────────────────────────────────────────┘
```

点击「开始」时：桌面端内联进入或顶层跳转（见 §3）；手机端直接跳转，并提示「返回大厅」入口。

---

## 3. 两种运行模式：内联 vs 跳转

| 模式 | 实现 | 优点 | 风险 |
|---|---|---|---|
| A. iframe 内联 | 大厅内 `<iframe src="games/ping-pong/index.html" sandbox="allow-scripts allow-same-origin allow-forms allow-popups">` | 切换快、留在「游戏包」语境、返回大厅零成本 | SW 与 `sandbox` 冲突；全屏/指针锁受限；WS 受 CSP |
| B. 顶层跳转 | `location.href = 'games/ping-pong/index.html'`，游戏内加「返回大厅」`href="../index.html"` | 与独立部署**行为完全一致**，坑最少 | 回大厅要重新加载 |

**建议：B 为主，A 只在作品集弹窗里用**。

- `game-arcade/index.html` 大厅点卡片 → **B（顶层跳转）**；
- 作品集首页预览弹窗（`openPreview`）→ 直接 iframe 打开 `projects/game-arcade/index.html`，大厅内部点击仍然是 iframe 里的跳转（同源，能跑，但 SW 会被 §6.1 的守卫拦住）；
- 若坚持 iframe 内联跑游戏：`sandbox` 不能收紧到禁用同源，且 SW 必须禁用。

---

## 4. 目录与同步策略（核心）

### 4.1 为什么不「物理合并」两个游戏

- 乒乓红线：`public/js/engine*` ↔ `src/engine*` ↔ `dist/ecs` ↔ APK 内 7 对**字节一致**；一旦把引擎挪进大厅目录，`tools/autosync.js` / `check-engine-sync.js` 全部失效。
- 返航录红线：单机与联机共用 `View.viewFor` 唯一裁剪出口，改动面有 30 篇文档背书。
- 结论：**游戏目录只做「搬运」，不做「改写」**；大厅只做「外壳」。

### 4.2 `sync.json` 新增段（草案，供确认）

```jsonc
{
  "id": "arcade",
  "enabled": true,
  "sourceDir": "..",                       // 相对 portfolio 的父目录（Desktop）
  "targetDir": "projects/game-arcade",
  "note": "游戏包：两个游戏的产物按白名单搬进 games/，大厅页在 projects/game-arcade 内维护",
  "files": [
    { "from": "乒乓对决_合并/public", "to": "games/ping-pong",
      "files": ["index.html","download.html","sw.js","manifest.webmanifest","css/style.css","js/**","icon-192.png","icon-512.png","audio/**"] },
    { "from": "太空杀游戏-完整版", "to": "games/space-kill",
      "files": ["index.html","css/**","js/**","audio/**","assets/**"] }
  ],
  "neverCopy": {
    "_警告": "以下文件绝不可进游戏包",
    "games/ping-pong/_worker.js": "Pages 高级模式 WS 转发，子目录里无意义且会与大厅路由冲突",
    "games/ping-pong/PingPongDuel.apk": "二进制不入库，走外链",
    "games/space-kill/SpaceKill.apk": "同上",
    "games/*/server/**": "本地联机服务，不进静态包"
  },
  "patches": [ /* 见 4.3 */ ]
}
```

> 现有 `sync-projects.js` 只支持 `files: string[]`。需要一次**向后兼容的小升级**：支持 `files` 里出现 `{from,to,files}` 分组与 `**` 通配（约 40 行）。旧的两段（delta-force / ping-pong-duel）不受影响。

### 4.3 需要的补丁规则（预计 6–10 条）

| 目标文件 | 补丁 | 原因 |
|---|---|---|
| `games/ping-pong/sw.js` | 子目录内不接管（守卫或软降级） | SW 作用域在 `/games/ping-pong/` 不越界，但会与作品集 iframe 打架 |
| `games/ping-pong/index.html` | `manifest.webmanifest` 处理 | 子目录下 PWA 清单无意义 |
| `games/ping-pong/download.html` | APK 改绝对地址（沿用现有规则） | 相对路径会落到 SPA 回退 |
| `games/space-kill/sw.js`（若有） | 同上守卫 | — |
| 两游戏 `index.html` | 可选注入 `<script>window.__ARCADE__=1</script>` | 游戏内据此显示「返回大厅」按钮 |

---

## 5. 大厅的技术选型（给设计留余量）

- **零构建**：与两个游戏一致，纯 HTML/CSS/JS，不加 bundler。理由：作品集本身就是「无构建」路线（Tailwind 是本地 vendor 文件，不是 CLI 编译）。
- **不引 Tailwind**：大厅自写 CSS（约 300 行），用 CSS 变量定主题，避免与现有 410 KB 运行时重复加载、也避免 CSP 放宽。
- **卡片数据** `hub.json`：字段 `id / name / desc / version / tags / thumb / entry / liveUrl / downloadUrl / attachmentUrl / capabilities: ["单人","本地双人","联机","PWA","APK"]`。**能力用字段声明，不用文字描述**。
- **存档隔离**：大厅只读写 `arcade:*` 前缀的键；游戏各自键不动（见 §6.3）。
- **返回大厅**：游戏页 URL 带 `?from=arcade` 时显示悬浮「← 大厅」（只注入 DOM，不改游戏逻辑）。

---

## 6. 风险与对策（逐条可验收）

### 6.1 Service Worker 越界 / 冲突 ✅已有成熟做法
`delta-force` 的 `sw-register.js` 补丁已经验证：`if (window.self !== window.top) return;` + `register('sw.js?v=…', { scope: './' })`。乒乓与返航录照抄同一套规则，**子目录 scope 天然不越界**。验收：iframe 内打开 → DevTools → Application → Service Workers 里**没有**新注册。

### 6.2 联机在 iframe / 子目录下不可用 ⚠需要决策
- 乒乓：`wss://ping-pong-duel.pages.dev/ws`（DO Worker），大厅 iframe 内会被 CSP `connect-src` 限制；
- 返航录：`space-kill-web` 自带 WS。

**决策建议**：大厅里联机按钮点击时**跳转独立站**（`https://ping-pong-duel.pages.dev`），大厅本身只承载单机/本地双人。这样「游戏包」不必背负两套后端，`arcade.pages.dev` 也不必额外部署 DO。
> 备选（成本高、暂不推荐）：给 `arcade.pages.dev` 也绑一个 DO 路由，用同一份 `src/room*.js`。优点是真的「一个包全功能」；缺点是乒乓双端镜像要多维护一套部署路径。

### 6.3 `localStorage` 键冲突
乒乓键：`aiLevel`、`teamMe`、`teamOpp`、`ppd-*` 等；返航录键独立命名。目前**没有已知冲突**，但同域后共享配额（5 MB）。
- 对策：大厅启动时做一次「键前缀体检」，把两游戏的键写入 `arcade:keys` 备案；超出配额时优先清理 replay（乒乓回放体积最大）。
- 验收：两游戏交替进出 10 次，回放与战绩不丢。

### 6.4 体积
乒乓 `public/` 约 3.6 MB（含 2 个 APK，排除后约 300 KB + 音频）；返航录含附件 PDF 约 5.6 MB（排除后约 1 MB）。大厅 + 两游戏预计 **< 2 MB**。**APK 与附件 PDF 一律外链**（与 `修改记录.md` 2026-09-13 的结论一致：作品集不承载二进制）。

### 6.5 CSP / 安全头
当前 `_headers` 是 `frame-ancestors 'self'`，同源 iframe 没问题。游戏包单独一份 `_headers`：
- `game-arcade` 子目录里**不要**再下发 `frame-ancestors`（避免嵌套第二层）；
- `connect-src` 仅在需要直连 WS 时放行对应 `wss://` 域名。

### 6.6 移动端
- 乒乓竖屏、返航录横屏（App 锁横屏）。大厅必须**横竖屏都能用**；返航录进入前提示「请横屏游玩」。

---

## 7. 验收清单（每项都要写读数）

- [ ] `npm run sync:dry` 无 `未匹配` 告警；`npm run sync` 后 `git status` 只有预期文件。
- [ ] `node build-collect.js` EXIT=0。
- [ ] 本地 `npx serve .` → `/projects/game-arcade/`：大厅可开、两张卡跳转正确、返回大厅可用。
- [ ] 作品集首页弹窗预览游戏包：无 SW 注册、无 CSP 报错（Console 0 error）。
- [ ] 六档视口（320/360/390/430/768/1280）：无横向滚动、无裁切（沿用乒乓的六档口径）。
- [ ] 两个游戏各**通玩一局**（乒乓人机 1 局；返航录单机 1 局到结算）。
- [ ] 离线（DevTools Offline）：大厅降级为静态卡片，不白屏。
- [ ] 线上 `arcade.pages.dev` 冒烟：`/`、`/games/ping-pong/`、`/games/space-kill/` 均 200 且 Content-Type 正确。

---

## 8. 版本记录与留痕规范（按你的要求，先定规矩）

### 8.1 文件分工

| 文件 | 写什么 | 不写什么 |
|---|---|---|
| `docs/GAME-ARCADE-方案.md`（本文件） | 决策、选型、风险 | 每次改动 |
| `projects/game-arcade/ARCADE-CHANGELOG.md` | 大厅自身的版本变更（Keep a Changelog 风格 + 中文标题） | 两个游戏的内部改动 |
| `portfolio/修改记录.md` | 仅「游戏包上线/改名/换版本」这类**作品集侧**事件，一条一段 | 细节 |
| `docs/AI-技术拓展-路线图.md` | AI 相关实验与开源参考 | — |
| `docs/开源调研.md` | 本次检索到的 GitHub 技巧与出处（含日期） | — |

### 8.2 变更记录模板（沿用乒乓 `修改记录.md` 的五要素）

```md
## YYYY-MM-DD · 主题（一句话）

**现象 / 需求**：
**根因 / 决策**：
**改动**：文件级清单
**验证**：命令 + 读数（禁止只写"已验证"）
**未做（本轮范围外）**：
**已知遗留**：
**已否决**：
```

### 8.3 版本号
- 大厅：`arcade v0.x.y`；`hub.json` 里同时记两个游戏的**引用版本**（乒乓 `3.2.1`、返航录 `V1preview / v1preview1.0`），每次同步后更新。
- **不做**统一语义版本号（两个游戏节奏不同），用「大厅版本 + 引用快照」表达。

---

## 9. 执行阶段（确认后按此顺序）

| 阶段 | 内容 | 预计改动量 | 回滚点 |
|---|---|---|---|
| P0 | 全量备份 `portfolio`（robocopy 到 `Desktop\portfolio-backup-YYYYMMDD`） | 0 | — |
| P1 | `sync-projects.js` 向后兼容升级（分组 + 通配） | ~40 行 | git |
| P2 | 新建 `projects/game-arcade/` 大厅页 + `hub.json` + `_headers` | ~600 行 | git |
| P3 | `sync.json` 新增 `arcade` 段 + 补丁规则，跑 `sync:dry` → `sync` | 配置 | git |
| P4 | 作品集首页新增「游戏包」卡片（`projects.json` + 一张卡），预览指向大厅 | ~40 行 | git |
| P5 | 验收清单全跑，写 `ARCADE-CHANGELOG.md` 与 `修改记录.md` | 文档 | — |
| P6（可选） | 独立域名 `arcade.pages.dev` 部署 + 大厅图标 AI 重绘 | 部署 | 域名可解绑 |

> 建议先把作品集内嵌入跑通，再做独立域名：域名是加一行 wrangler 的事，风险低但会引入部署配置漂移。

---

## 10. 待拍板的 4 个点

1. **大厅名称**：`何向杰的游戏包` / `ARCADE` / `两个游戏` —— 影响卡片文案与 URL。
2. **联机**：接受「联机跳独立站」（推荐），还是要把 DO 也接进游戏包？
3. **返航录源目录**：确认用 `Desktop\太空杀游戏-完整版`（不是已退役的 `space-kill-3.0`）。
4. **是否给游戏页注入「返回大厅」悬浮按钮**（需要改游戏 `index.html` 一行；不注入则靠浏览器返回）。
