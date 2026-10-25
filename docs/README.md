# 交接入口

> 最新交接文档：[`docs/交接文档.md`](交接文档.md)（2026-10-21 · HEAD `c1aef40` 时代）

本仓库的文档分三类，**别混着看**：

| 类型 | 位置 | 说明 |
|---|---|---|
| 交接文档 | `docs/交接文档.md` | **接手先读这个**：结构、渲染链路、部署、设计约定、自检清单 |
| 方案文档 | `docs/*-方案.md`、`docs/AI-技术拓展-路线图.md` | 决策与选型。**注意**：`GAME-ARCADE-方案.md` 与 `作品集设计优化方案.md` 已被取代，保留作历史 |
| 变更记录 | `docs/变更记录/YYYY-MM/` | 一条一个文件，五要素 + 验证读数。这是**唯一的事实流水** |

## 一分钟上手

```bash
npm run check      # 文案守门 + 规则同步 + 响应头 + 内嵌适配
npm run collect    # 项目收集（应 6/6）
npm run sync:dry   # 同步预演（应 3 同步 / 2 跳过 / 0 失败）
npm run check:demo # 演示视频守门（首屏/作品卡/合集页的视频可播）
npx serve . -p 3000   # 本地预览
```

## 三个最容易踩的坑

1. **卡片不是手写的**——由 `projects.json` + `js/site.js` 渲染，改 `index.html` 没用。
2. **`projects/game-collection/games/` 是同步产物，但已入库**（2026-10-24 起，约 117 个文件）。
   要改游戏内容请改源仓库再 `npm run sync`——直接改这里的文件会被 `verify-sync` 判为
   「产物被手工改过」，CI 也会红。
3. **推送前先 `git fetch origin`**——`sync-attachment-site` 工作流会在你推送间隙提交，
   发现分叉用 `git rebase`（不是 merge），rebase 后 Gitee 需 `--force`。

> ⚠️ 本地 `node tools/verify-sync.cjs` 会把 `delta-force` 的差异也报出来。
> 若该仓库本地领先远端（有未推送提交），那几个文件的"落后"是**本地假象**，
> CI 走远端克隆不受影响——别为了让它变绿去 `--fix`，那会把未发布的改动带进作品集。
