# COLLECTION-CHANGELOG — 游戏合集

> 合集只承载入口与统一视觉；两个游戏分别维护、分别部署。
> 表格字段：日期 / 合集版本 / 引用版本 / 改动 / 验证。

## 0.2.0 — 2026-11-12

**引用版本**：乒乓对决 `v3.6.0` · 返航录 2.5D / 过渡式表单 · 3D Demo 档位

### 新增
- 合集页从「两卡」改为「2 个游戏 / 3 个可玩形态 + 1 个 3D Demo 档位」：
  乒乓对决、返航录 2.5D、返航录过渡式表单版、返航录 3D 槽位
- 返航录 2.5D 用 `../../assets/projects/returnlog-demo.mp4` 作为 Demo 档位；
  3D 版是虚线 Demo 槽位，待 Godot Web 导出后接入
- 视觉与作品集检验单版对齐：浅纸底、墨字、朱红状态标记；去掉深色渐变卡片与光晕/网格装饰
- 保留 `__ARCADE_SW__` 标记、横屏提示与「进视口才播」；`prefers-reduced-motion` 下不自动播放

### 验证（2026-11-12）
- `node tools/check-copy.cjs`：4 文件 6 规则 0 命中
- CDP 1440 / 390 / 320：`scrollWidth == viewport`，4 个条目、1 个 3D 槽位、
  2 个视频 `readyState=4`、过渡式表单截图 `naturalWidth=1280`

### 未做
- 3D 版可玩 Demo 由另一条工作流接入；本页只留槽位
- 2.5D Demo 复用作品集已有的实机录像，未重新录制

## 0.1.0 — 2026-10-21

**引用版本**：乒乓对决 `v3.2.1` · 返航录 `V1preview（规则口径 v1preview1.0）`

### 新增
- `index.html` 合集首页：两张并列卡片（乒乓 / 返航录），各自「开始游玩 / 独立站 / 规则与资料」
- `collection.css` / `collection.js`：合集专用样式与移动端横屏提示，不依赖任何外部资源
- `assets/card-ping-pong.png`、`assets/card-return.png`：由各自源页面 headless 渲染（1280×800）
- `games/ping-pong/`、`games/space-kill/`：由 `sync.json` 的 `game-collection` 段白名单同步（109 个文件）

### 约定
- **两个游戏代码零改动**（除源仓库自己的版本演进）；合集不改游戏逻辑、不改各游戏 `localStorage` 键
- 联机跳各游戏独立站：`ping-pong-duel.pages.dev` / `returnlog.pages.dev`
- 合集在作品集 iframe 中预览时**不注册 Service Worker**（`window.__ARCADE_SW__` 标记位由 `sync-projects.js` 探测）

### 验证（2026-10-21）
- `node sync-projects.js --dry-run`：同步 3 / 跳过 2 / 失败 0
- `node sync-projects.js`：更新 109 个文件，`games/` 下 ping-pong 35 个、space-kill 74 个文件；**0 个 APK**
- 静态自检：`games/ping-pong/index.html`、`games/space-kill/index.html`、两张卡图均 200（本地 http 服务）
- 乒乓源仓库 `node server.js` 本地可起，`GET /` 200（43,870 B）
- 截图：`docs/data/shot-collection.png`

### 未做
- 独立域名 `arcade.pages.dev` 部署（P6，需你确认后再开）
- 游戏内「返回合集」悬浮按钮（需改两个游戏 `index.html`，本轮未做）