# 个人作品集

零构建静态作品集：数据驱动渲染，收录《新返航录》《乒乓对决》《落幕查》等项目的演示、截图与入口。

- 在线访问：<https://portfolio-ji.pages.dev>
- 源码：<https://github.com/hxj-2888/portfolio>

## 运行

直接打开 `index.html`，或在目录下启动任意静态服务器：

```bash
python -m http.server 8000
```

## 结构

- `index.html` / `css/` / `js/`：页面与渲染
- `assets/`：截图、演示视频、二维码与图标
- `projects/`：可嵌入的作品页
- `projects.json`：作品数据源
- `functions/`：Cloudflare Pages 的只读 API 适配

## 部署

```bash
wrangler pages deploy . --project-name portfolio-ji
```

## 许可

MIT，见 `LICENSE`。
