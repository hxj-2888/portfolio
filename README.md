# 作品集 · portfolio

零构建、零框架、零运行时依赖的静态作品集：**页面不写死任何作品，一切从 `projects.json` 渲染**。收录游戏、工具与文档类共 7 个条目，每个数字都带一个可以点开的出处。

- 在线访问：<https://portfolio-ji.pages.dev>
- 本地跑：`npx serve . -p 3000`，或直接双击 `index.html`（首屏数据已内联，见下）
- 版本：2.0.0 · 代码 MIT

---

## 一、收录了什么

| 条目 | 分组 | 版式 | 一句话 |
|---|---|---|---|
| 新返航录 | play | `versions` | 11 人类对 4 异形的实时太空船对抗，同一目录下列出 2.5D / 3D / 过渡式表单版三个形态 |
| 乒乓对决 | play | `split` | ITTF 标准球台的真实物理乒乓球，带看台 / 球员甲 / 球员乙三段视角演示 |
| 游戏合集 | play | `note` | 两个游戏的统一入口，四档形态，可直接在作品集里开玩 |
| 落幕查 | tools | `data` | 变卖物实时价格查询，大字读数版式（件数、保留天数、安卓版本） |
| 实盘终端 | tools | `data` | A 股全市场 + 全球市场单页行情终端 |
| 规则正文与资料 | process | `note` | 返航录的规则正文、速查卡、术语表与判定流程图（PDF 随仓发布） |
| 作品集 · 本站 | process | `note` | 本站自身，作为一个「0 依赖」条目登记在同一份数据源里 |

分组语义：`play` = 可玩，`tools` = 可用，`process` = 过程与依据。「可玩网页游戏有几个」这类对账数由脚本在运行时算出来，**不手写**，所以不会出现「文案说 3 个、列表里只有 2 个」。

## 二、数据契约：`projects.json` 是唯一真相

新增或修改作品**只改这一个文件**，首屏清单、作品面板、弹窗与二维码全部由它渲染。每条作品的字段：

| 字段 | 含义 |
|---|---|
| `id` | 目录名，必须与 `projects/<id>/` 一致 |
| `group` / `order` | 首页分组与组内排序 |
| `name` / `tagline` | 标题与一句话（≤28 字，不写括号补充） |
| `tags` | 最多显示 3 个 |
| `status` | `live` / `local` / `collection`——决定清单行给不给链接。`local` 渲染成虚线「待接入」槽位，**不配链接**（3D 版当年就是这样留位的） |
| `proof` / `proofUrl` | 可核对字符串（版本 / 指纹 / 对账数）+ 它的出处链接。等宽显示；核对不了的量词写进 `tagline`，不塞这里 |
| `versions` | 同一项目的多个可玩形态，逐条给状态与出处 |
| `spec` | 规格表（`split` 版式用） |
| `figures` | 数据版式的大字读数 |
| `demo` / `demoViews` | 静音循环的演示视频与多视角切换 |
| `layout` | `versions` / `split` / `data` / `note`——按作品性质选版式，不是同一张卡片套四个项目 |
| `countsAsGame` | 是否计入「可玩网页游戏」对账数 |

**首屏不发第二个请求**：构建时把整份 `projects.json` 内联进 `index.html` 的 `<script type="application/json" id="projects-data">`，页面直接读内联块；`fetch('projects.json')` 只是内联块缺失时的兜底，且带两次重试与失败占位（「作品数据没有加载出来 · 重新加载」）。这样网络抖动只会影响样式与脚本，不会把整块作品区打成空白。

## 三、渲染口径

- **「检验单」式布局**：左栏是状态 / 名称 / 口径，右栏是证据与入口。颜色只保留两种语义——朱红＝验收章 / 待检，松绿＝在线，不给每个作品分配色块。
- **不写内联 `style`**：首页 CSP 是 `style-src 'self'`，样式全走 `css/`（`tokens.css` 设计令牌 → `art.css` 视觉 → `components.css` 组件 → `page.css` 页面）。
- **项目预览用同源 iframe** 加载 `projects/<id>/`，所以 `X-Frame-Options: SAMEORIGIN`、`frame-ancestors 'self'`；内嵌的游戏要访问同源 `/api` 与 `wss://` 联机，`connect-src` 相应放行。

### CSP 分层有个坑

Pages 的 `_headers` 是**继承 + 合并**：同名的头会用逗号拼接，而 CSP 规范把逗号分隔的每条策略都当独立策略执行（取交集）。所以「根路径写严格 + `/projects/*` 再写一条宽松」的实际效果是**只会执行严格那条**，内嵌页的内联脚本与样式全被拦。现在的做法是：`/projects/*` 先用 `! Content-Security-Policy` **删掉继承来的严格策略**，再设一条允许内联的宽松策略。改这个文件前务必本地验一遍内嵌页。

## 四、附带一个只读 API 适配层

`functions/api/[[path]].js` 让内嵌的「落幕查」作品页能在作品集域名下直接取数，不必跳站：

- `GET /api/metadata` —— 元数据，KV 优先、静态 JSON 回退；
- `GET /api/history/:itemId` —— 价格历史，读 Cloudflare D1；
- 其余上游请求走**端点枚举白名单**代理，带来源校验与限流。

因此 `wrangler.toml` 里挂了 D1 与 KV 绑定。**自建部署时这些 ID 要换成自己账号下的值**（缺 D1 迁移的话历史曲线是空的）。这类绑定只是资源标识，不含凭据；真正的 Token 放在 Cloudflare 的加密环境变量里，不进仓库。

## 五、结构

```
portfolio/
├── index.html            # 单页入口 + 内联的 #projects-data 块
├── projects.json         # 作品数据源（唯一真相）
├── js/site.js            # 渲染与交互（零依赖，含数据加载兜底）
├── css/                  # tokens / art / components / page
├── assets/               # 截图、演示视频、二维码、og 图、模型
├── projects/             # 可独立打开的作品页（游戏合集、乒乓、三角洲工具、规则 PDF…）
│   └── game-collection/  # 内嵌的可玩游戏合集
├── functions/api/        # Pages Functions 只读 API 适配
├── docs/                 # 规则映射表等随站发布的资料
├── _headers              # CSP 与安全响应头（含分层规则）
└── wrangler.toml         # Pages 项目名、nodejs_compat、D1 / KV 绑定
```

`projects/<id>/` 下是各作品的**独立可运行副本**（自带资源与入口），既能被本站 iframe 嵌入，也能单独打开——所以它们体积不小，但换来了「点开就能看到真的东西」。

## 六、部署

```bash
npx wrangler pages deploy . --project-name portfolio-ji
```

`wrangler.toml` 里的 `compatibility_date` 与 `compatibility_flags = ["nodejs_compat"]` **不能删**：wrangler v4 缺少兼容日期时会注入引用 `node:` 内置模块的运行时 shim，Functions 随即打包失败（`No such module node:stream`）。

> 本仓发布的是站点产物、作品页与数据源；把作品从各上游仓同步进来、以及文案 / 头 / 内联块一致性的体检脚本不随本仓发布。改 `projects.json` 后如果要上线，记得同步 `index.html` 里的内联块，否则首屏读到的仍是旧数据。

## 七、许可

代码以 **MIT** 许可发布，见 [LICENSE](LICENSE)。演示视频、截图与二维码为本项目自制；作品页内嵌素材（图标、字体、光效等）保留各自来源的署名与许可文件，二次分发时一并保留。
