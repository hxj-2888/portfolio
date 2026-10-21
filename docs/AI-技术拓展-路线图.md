# AI 技术拓展路线图 · 游戏引擎 / Blender 建模 / AI 美术

> 状态：**方案稿（待确认后执行）** · 起草 2026-10-21
> 依据：`docs/开源调研.md`（GitHub 检索）＋ 本机实测（Blender 5.2.2 LTS 位于 `E:\SteamLibrary\steamapps\common\Blender\blender.exe`，Node `F:\程序开发工具\node.exe`，Python `C:\Python314\python.exe`）
> 原则：**AI 生成的每一步都要能落到文件、进 git、可复跑**；不引入需要联网的运行时依赖（作品集 CSP 只允许 `'self'`）。

---

## 0. 一句话策略

三条线并行，但**共用一条「资产流水线」**：

```
提示词/参考图 → (AI 出图) → Blender 里摆/绑/出 glTF → 静态资源进 git → 网页/游戏读取
                        ↘ (AI 直接写 bpy 脚本驱动 Blender) ↗
```

线上**不调用任何生成式 API**；AI 只在「产出资产」这一步出现。这样作品集不用放宽 CSP，也不会因为 API 抖动导致页面挂掉。

---

## 1. 三条技术线（按投入产出排序）

### 线 A：AI 写脚本驱动 Blender（投入最小，先做）★推荐
- **做法**：不给 Blender 装任何插件，用 `blender --background --python xxx.py` 跑仓库里受控的 Python 脚本；脚本由 AI 起草、人审、进 git。
- **为什么**：零安装依赖、可复现、可 diff；MCP 那类桥接（`mcp-for-blender` 3.1 万星）本质也是「让模型写 bpy 代码并执行」，只是多了交互层，等需要实时对话再上。
- **交付物**：`tools/blender/` 下的脚本 + `assets/models/*.glb`。
- **风险**：`bpy` 的 API 在 4.x→5.x 有变动，脚本必须钉住 Blender 版本（`blender --version` 断言）。

### 线 B：AI 出图 → Blender 处理 → glTF 导出
- **做法**：AI 生成道具/场景贴图或概念图 → 在 Blender 里做低模 + 贴图 + 简单绑定 → 导出 `.glb`（Draco 可选）→ 网页用 Three.js/自写 WebGL 加载。
- **用途**：作品集封面图、游戏包大厅的两张卡图、乒乓的器材/观众席升级。
- **注意**：**不要图生 3D 直接进游戏**（TRELLIS 类产物面数高、UV 乱），只作为「概念图→手工低模」的中间步骤。

### 线 C：AI 辅助游戏逻辑（返航录的 AI 托管）
- **做法**：把现有的 if-else 决策整理成**行为树**（参考 `bitbrain/beehave` 的节点语义：Selector/Sequence/Condition/Action/Decorator），让「为什么 AI 这样做」可解释、可单测。
- **收益**：你的门禁里已有蒙特卡洛（10000 局胜率漂移 ≤3pp），行为树能把「漂移来自哪个节点」直接定位。
- **注意**：这是**玩法改动**，与乒乓「只改排版不动玩法」的边界不同，需要先在你的 `AGENTS.md` 里声明范围。

---

## 2. 落地示例（本轮可交付的最小验证）

**目标**：证明「AI 起草的 bpy 脚本 → 可复跑的 glTF → 作品集页面能显示」这条链路通。

```
tools/blender/
├─ check-env.py            # 断言 Blender ≥ 5.2，打印版本与 glTF 导出器可用性
├─ export_table.py         # 生成「乒乓台」低模 + 材质 + 相机，导出 assets/models/ping-pong-table.glb
└─ README.md               # 复跑命令、参数、产物哈希

assets/models/
└─ ping-pong-table.glb     # 产物（小体积，可入库）
```

复跑命令（Windows）：

```powershell
& "E:\SteamLibrary\steamapps\common\Blender\blender.exe" --background --factory-startup `
  --python tools/blender/export_table.py -- --out assets/models/ping-pong-table.glb
```

验收：
- 产物存在且 `< 200 KB`；`file` 头是 `glTF`；
- 连续两次运行输出的**顶点数/三角面数一致**（确定性）；
- 页面加载不报 404/CORS。

> 没装 Blender 的机器上，脚本要打印明确的中文错误并 `exit 1`，不许静默跳过（沿用乒乓 `AGENTS.md` 红线 7「同步工具不许静默跳过」）。

---

## 3. 分阶段计划

| 阶段 | 内容 | 产出 | 验收 |
|---|---|---|---|
| P1（本轮） | 环境探测脚本 + 乒乓台 glb 导出脚本 + 文档 | `tools/blender/*`、`assets/models/*.glb` | 复跑两次字节一致（或顶点数一致） |
| P2 | 网页侧加载：给游戏包大厅加一个「3D 资产预览」小节（用纯 WebGL 或 Three.js 本地 vendor 文件） | 大厅内嵌预览 | 六档视口正常、无联网请求（DevTools Network 全为本地） |
| P3 | AI 美术：按统一提示词模板批量出图（道具/图标/封面），人工筛 → 进 `assets/` | 提示词模板 + 资产清单 | 每张图有来源记录（提示词、模型、日期）以便复用与合规 |
| P4 | 资产规范：命名 `<项目>_<对象>_<版本>.glb`、面数上限、贴图 1024、导出预设存成 `.blend` 里的 custom props | 规范文档 | 新资产按规范可一键校验（脚本） |
| P5（可选） | 实时 Blender 桥接：接 `mcp-for-blender`，让 DSH 在会话里直接改场景 | 接入说明 | **只在本地**运行，不暴露端口到公网 |

---

## 4. 素材合规与留痕（重要）

- **每个 AI 生成素材**在 `assets/ATTRIBUTION.md` 记一行：`文件名 | 生成方式（模型/版本/平台） | 提示词摘要 | 生成日期 | 人工修改点`。
- 参考图/模型**只在商业许可明确的模型下生成**；不确定的一律标「仅内部参考，不发布」。
- Blender 插件多为 **GPL**（如 `scenario-labs/blender-plugin`），**GPL 插件不影响你的静态网页**，但插件代码不可抄进 MIT 许可的作品集仓库。

---

## 5. 已实测的环境事实（2026-10-21）

| 项 | 值 |
|---|---|
| Blender | `5.2.2 LTS`（build 2026-09-15），路径 `E:\SteamLibrary\steamapps\common\Blender\blender.exe` |
| Node | `F:\程序开发工具\node.exe` |
| Python | `C:\Python314\python.exe`（Blender 自带 Python 独立，脚本不要依赖系统 Python 包） |
| 磁盘 | C: 18 GB 可用 / D: 92 GB / E: 93 GB / F: 28 GB |

> 下一步的 P1 会在此表基础上补「glTF 导出器是否可用」「Draco 压缩是否可用」两行。

---

## 6. 待你拍板

1. **P1 示例做哪个对象**：乒乓台（推荐，尺寸有 ITTF 标准、能和游戏对上）／返航录的飞船／通用的一个小场景。
2. 网页侧加载用 **Three.js（vendor 进仓库）**还是**手写 WebGL**？前者省事但要引入 ~600 KB；后者零依赖但写起来慢。
3. AI 出图走**哪个模型/平台**（影响提示词模板与合规记录字段）。
