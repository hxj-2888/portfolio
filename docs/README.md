# 交接入口

> 最新交接文档：[`docs/交接文档.md`](交接文档.md)（2026-11-13 · HEAD `a208ca7`）

本仓库的文档分三类，**别混着看**：

| 类型 | 位置 | 说明 |
|---|---|---|
| 交接文档 | `docs/交接文档.md` | **接手先读这个**：结构、渲染链路、部署、设计约定、自检清单 |
| 变更记录 | `docs/变更记录/YYYY-MM/` | 一条一个文件，五要素 + 验证读数。这是**唯一的事实流水** |
| 修改记录 | `../修改记录.md` | **入口索引**：滚动「最新一条」+ 最近变更表；2026-09 及更早是冻结总账 |
| 方案文档 | `docs/*-方案.md`、`docs/AI-技术拓展-路线图.md` | 决策与选型。**注意**：`GAME-ARCADE-方案.md` 与 `作品集设计优化方案.md` 已被取代，保留作历史 |

## 一分钟上手

```bash
npm run check:docs:all  # 推送前全套：新鲜度 + 事实契约 + 推送联动（必跑）
npm run check:facts     # 只跑事实契约：文档数字/读数/索引 == 代码事实
npm run check:push      # 只跑联动：本次提交是否带了记录与索引
npm run check:docs:full # 额外实跑 collect（CI 用）
npm run check           # 文案守门 + 规则同步 + 响应头 + 内嵌适配 + 内联数据
npm run data:inline     # 改 projects.json 后：把数据写进首页内联块
npm run check:inline    # 只校验内联数据与 projects.json 是否一致
npm run collect         # 项目收集（应 7/7）
npm run sync:dry   # 同步预演（应 2 同步 / 2 跳过 / 1 失败，失败项见下）
npm run check:demo # 演示视频守门（首屏/作品卡/合集页的视频可播）
npx serve . -p 3000   # 本地预览
```

> ⚠️ **两个读数是「环境性红」，不是回归**（2026-11-06 核实）：
> 本地 `../太空杀游戏-完整版` 已被删除/改名，于是 `check-rules-sync` 的 A/C/D 三项失败、
> `sync:dry` 的 `game-collection` 段失败退出。CI 从远端克隆源仓库，不受影响。
> **不要为了让它变绿去改 `rules-map.json` 或 `sync.json`。**

## 四个最容易踩的坑

1. **卡片不是手写的**——由 `projects.json` + `js/site.js` 渲染，改 `index.html` 没用。
2. **改 `projects.json` 后跑 `npm run data:inline`**——首页渲染读的是 `index.html` 里的内联 JSON，不再发第二次请求；漏跑会被 `check:inline` 拦下。
3. **`projects/game-collection/games/` 是同步产物，但已入库**（2026-10-24 起，约 117 个文件）。
   要改游戏内容请改源仓库再 `npm run sync`——直接改这里的文件会被 `verify-sync` 判为
   「产物被手工改过」，CI 也会红。
4. **推送前先 `git fetch origin`**——`sync-attachment-site` 工作流会在你推送间隙提交，
   发现分叉用 `git rebase`（不是 merge），rebase 后 Gitee 需 `--force`。

## 推送前必须做的两件事

> 强制规则见 [`../AGENTS.md`](../AGENTS.md) §二，`npm run check:docs` 负责校验。

1. 在 `docs/变更记录/YYYY-MM/` 新增一条记录（五要素，验证写可复跑的命令 + 读数）。
   同一次推送跨主题就拆成多个文件，不要混成一条。
2. 刷新 `../修改记录.md` 的「最新一条」与「最近变更」表；若结构/读数变了，
   同步更新本文件与 `../docs/交接文档.md`（HEAD、项目条数、自检清单读数）。

三道自动门禁，各管一件事，任一不满足就红：

| 命令 | 检查 | 触发点 |
|---|---|---|
| `check:docs` | 记录日期 ≥ 最近提交、`修改记录.md` 指向**最新日期**的记录（同日可并列）、交接文档 HEAD 跟得上 | pre-push hook + CI |
| `check:facts` | 文档里的项目条数、规则读数、collect 读数、索引表 == 代码实值 | pre-push hook + CI（`--full` 实跑） |
| `check:push` | 本次 commit range 改了实质文件，是否带新记录 + 索引刷新 | pre-push hook + CI |

`git push` 会自动触发 `.githooks/pre-push`（本地 `core.hooksPath = .githooks`），
GitHub 侧另有独立工作流 `docs-gate.yml`；**Gitee 侧只有本地 hook，没有 CI**。
机器人提交（`sync(` / `github-actions`）按 AGENTS.md §2.5 放行。
事实契约的断言清单在 `tools/doc-facts.mjs`，加新断言只改那一个文件。

> ⚠️ 本地 `node tools/verify-sync.cjs` 会把 `delta-force` 的差异也报出来。
> 若该仓库本地领先远端（有未推送提交），那几个文件的"落后"是**本地假象**，
> CI 走远端克隆不受影响——别为了让它变绿去 `--fix`，那会把未发布的改动带进作品集。
