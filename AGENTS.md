# AGENTS.md — 个人网页

> 本文件是 Agent 在本仓库的**强制行为约定**，不是建议。
> §一 约定命令行；**§二 是推送前的硬性要求，每次推送都必须执行，无例外。**

---

## 一、PowerShell 7（强制）

- **只在需要调用命令行时使用**：能用专用工具、API 或直接编辑完成的操作，直接用对应工具，不要为了用命令行而用命令行。
- 需要调用命令行时，统一用 **PowerShell 7**：`pwsh` / `pwsh.exe`；**不要用 Windows PowerShell 5.1**（`powershell.exe`）。
- 默认不用 Git Bash / `cmd.exe`；仅当项目脚本明确依赖 POSIX 工具且无法用 PowerShell 等价实现时，先说明原因再使用。
- 多行脚本写成临时 `.ps1`，用 `pwsh -NoProfile -File` 调用；环境变量用 `$env:VAR='...'`，路径含空格时加引号。
- 校验：`pwsh -NoProfile -Command '$PSVersionTable.PSVersion.ToString()'` 应输出 7.x（本机 7.6.5），不是 5.1。

---

## 二、推送即同步文档（强制，无例外）

### 2.1 铁律

**每一次推送，都必须把「修改记录」和「阅读文件」更新到反映本次改动的最新状态。**
不存在"这次只改一行代码所以不用写"的例外，也不存在"先推上去等下再补"的例外——
2026-10-21 到 11-06 期间就是因为这个例外，断了 **15 个提交、12 天**没人发现。

推送前必须先跑：

```powershell
npm run check:docs:all  # 新鲜度 + 事实契约 + 推送联动，不绿不许推
```

`git push` 时 `.githooks/pre-push` 会自动再跑一遍（本地已设 `core.hooksPath = .githooks`），
GitHub 侧另有独立工作流 `docs-gate.yml`。**三道任一不过就是硬阻塞**，不是警告：
不要 `git push --no-verify` 绕过、不要改校验脚本让它变绿、不要「先推再补」。

三道各管一件事，别用一个替代另一个：

| 命令 | 拦什么 | 典型报错 |
|---|---|---|
| `check:docs` | 断更：记录日期、索引指向、交接 HEAD | 「最新记录 x，但最近提交是 y」 |
| `check:facts` | 写错：文档数字 / 读数 / 索引表与代码不符 | 「代码真值 7，docs/README.md 写的是 6」 |
| `check:push` | 漏带：本次提交改了实质文件却没带记录 | 「33 个实质文件，却没有新增变更记录」 |

### 2.2 什么算「修改记录」

两个文件，职责不同，**都要动**：

| 文件 | 职责 | 每次推送必须做的 |
|---|---|---|
| `docs/变更记录/YYYY-MM/YYYY-MM-DD_主题.md` | **事实流水**，一条一个文件 | 新增一条（本次推送一个文件；跨主题就拆成多个） |
| `修改记录.md`（根目录） | **入口索引**，谁打开都能看到最新 | 刷新 `LATEST` 区块的「最新一条」+「最近变更」表第一行 |

记录必须是五要素，缺一不可：

1. **现象/需求** —— 为什么要改（问题现象、需求来源）
2. **根因/决策** —— 为什么这么改（含被否决的方案）
3. **改动（文件级）** —— 改了哪些文件、各自改了什么
4. **验证** —— **只写能复跑的命令 + 真实读数**，禁止只写「已验证」「测试通过」
5. **未做/遗留** —— 没做什么、留下什么坑、下一步

书写细则见 `docs/变更记录/README.md`。

### 2.3 什么算「阅读文件」

「阅读文件」= 接手的人**最先读、用来建立全局认知**的那几份，不是所有 `.md`：

| 文件 | 什么时候必须更新 |
|---|---|
| `docs/README.md`（交接入口） | 门禁命令/读数变了、文档分类变了、新增「最容易踩的坑」 |
| `docs/交接文档.md` | 目录结构变了、渲染链路变了、部署方式变了、自检清单读数变了、已知遗留增减 |

判定标准：**按文档里写的步骤操作，会不会得到和文档不一样的结果？** 会 → 必须改。

具体到高频项：

- `当前 HEAD：` 必须更新（`check:docs` 会校验它是当前 HEAD 的祖先且落后 ≤ 2）
- `projects.json` 的条数、分组、`band` 用法变了 → §一 表格与 §八 自检清单一起改
- 门禁命令的**读数**变了（如 `collect 7/7`、`sync:dry 2/2/1`）→ 三处（`docs/README.md`、`交接文档.md` §八、相关记录）全部对齐
- 「已知遗留」里的事做完了 → **删掉那条**，不要留在表里变成谎言

### 2.4 禁止事项

- ❌ **编造读数**。没跑的命令不许写读数；跑了没通过就写"未通过 + 报错原文"。
- ❌ **把环境问题写成代码回归**，或反之。本地缺源目录导致的红（见 `交接文档.md` §九）必须在文档里标成"环境性红"。
- ❌ **补记冒充现场记录**。事后回填的记录必须在开头写「补记」+ 回填依据（提交号），并说明哪些取舍无法还原。
- ❌ **把多条不相关的改动塞进一条记录**。
- ❌ **改校验脚本让红灯变绿**。红灯是信息，不是障碍。
- ❌ 只更新 `修改记录.md` 不写 `docs/变更记录/` 条目（索引指向空气），或反之（索引过期）。

### 2.5 例外（仅此两种）

1. **CI 机器人提交**：`sync(space-kill):` 这类由工作流产生的提交，不要求写记录。`check:docs` 按 `sync(` 前缀 + `github-actions` 作者自动放行。人工提交用 `sync:` 前缀（冒号）仍**必须**写记录。
2. **纯 typo / 空格修正**：可以只写一行记录，但仍要写，且仍要刷 `修改记录.md` 的第一行。

### 2.6 推荐流程

```
改代码（改了 projects.json → 先 npm run data:inline）
  → npm run check / check:demo（按改动类型）
  → 写 docs/变更记录/YYYY-MM/YYYY-MM-DD_主题.md（五要素）
  → 刷 修改记录.md 的 LATEST 区块 + docs/变更记录/README.md 索引表
  → 结构/读数有变则刷 docs/README.md + docs/交接文档.md
  → 数字/读数变了 → 同步文档并在 tools/doc-facts.mjs 加/改断言
  → npm run check:docs:all    （必须绿）
  → git fetch origin          （CI 可能在推送间隙提交，分叉就 rebase）
  → 推 GitHub 和 Gitee        （pre-push hook 自动复检）
```

### 2.7 自动化门禁（2026-11-06 起）

| 触发点 | 覆盖 | 跑什么 |
|---|---|---|
| `git push`（`.githooks/pre-push`） | GitHub + Gitee | `check:push --stdin` → `check:facts` → `check:docs`，`set -e` |
| GitHub Actions `docs-gate.yml` | push / PR / 手动 | `check:facts --full` → `check:docs` → `check:push --base … --head HEAD` |
| 手动 | 随时 | `npm run check:docs:all`；`npm run check:docs:full` 额外实跑 collect |

- 机器人提交（`sync(` 前缀、`github-actions` 作者）在 `check:docs` 与 `check:push` 里都放行（§2.5）。
- **首次推送**（无 upstream / 无 `HEAD^`）不再是盲区：`check:push` 改为检查 HEAD 可达的全部提交（2026-11-06 修）。
- `docs-gate.yml` 是**独立 workflow，不阻塞部署**；要硬卡上线，去 GitHub 分支保护把 `docs` job 设为必需检查。
- 契约清单在 `tools/doc-facts.mjs`。**文档里出现可计算的数字，就在那里加断言**，否则下次漂移还是没人发现。
- 关闭 hook：`git config --unset core.hooksPath`；紧急绕过：`git push --no-verify`（事后必须补记录）。

### 2.8 素材来源（2026-11-09 四项目统一裁定）

**素材优先取自公开网络与开源社区，不自己单独造。** 截图 / 图标 / 插画 / 音效 / 字体等，
先检索公开素材站与开源社区，许可合适的直接用；没有合适的才本地生成，且生成前先取公开设计参照。
来源必须留痕（URL / 作者 / 许可）；本站是作品集，引用他人素材的署名与许可边界比游戏本体更敏感，
缺署名的素材一律不上站。

---

## 三、容易踩的坑（与本仓库强相关）

1. **卡片不是手写的**——由 `projects.json` + `js/site.js` 渲染，改 `index.html` 没用。
2. **`projects/game-collection/games/` 是同步产物但已入库**——直接改会被 `verify-sync` 判为「产物被手工改过」。要改游戏请改源仓库再 `npm run sync`。
3. **别为了让门禁变绿去 `--fix`**——`delta-force` 本地领先远端时，`verify-sync` 报的"落后"是本地假象，`--fix` 会把未发布的改动带进作品集。
4. **`projects/_headers` 不要再加回来**——它不会被合并进响应，看着像治好了其实没有；CSP 用的是根 `_headers` 里的 `/projects/*` 规则（先 `! Content-Security-Policy` 删除继承的严格策略，再设宽松策略）。
5. **改 `projects.json` 后必须跑 `npm run data:inline`**——首页渲染用的是 `index.html` 里的内联 JSON 副本，不再依赖第二次 `fetch`；`check:inline` 会拦漂移。
6. **合集页 `projects/game-collection/index.html` 是手写的**（不是 `games/` 同步产物）。返航录 3D 的 Demo 档位在 `3D_DEMO_SLOT` 注释处；接入时替换媒体块，不要改 `games/space-kill/`。
