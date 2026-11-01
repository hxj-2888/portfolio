/* 作品集 · Cloudflare Pages 部署（白名单暂存 + wrangler）
 * 用法： node tools/deploy-pages.cjs [--dry-run]
 * 依赖： wrangler（PATH 或 WRANGLER_CMD）+ CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
 *
 * 只暂存站点真正需要的文件：index.html / projects.json / _headers / css / js / assets / functions。
 * 不复制 .git、node_modules、space-kill-3.0（附件站源文档）、projects/（内嵌游戏副本由各自流程维护）。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PROJECT = process.env.CF_PROJECT || 'portfolio-ji';
const ENTRIES = ['index.html', 'projects.json', '_headers', 'css', 'js', 'assets', 'functions'];
const DRY = process.argv.includes('--dry-run');

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-pages-'));
let n = 0, bytes = 0;
function copy(rel) {
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) return;
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(src)) copy(path.join(rel, name));
    return;
  }
  const dst = path.join(stage, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  n++; bytes += st.size;
}
for (const e of ENTRIES) copy(e);
console.log('[portfolio] 暂存 ' + n + ' 文件 · ' + (bytes / 1048576).toFixed(1) + ' MB → ' + stage);
if (DRY) { console.log('[portfolio] --dry-run'); process.exit(0); }

const cmd = process.env.WRANGLER_CMD || 'wrangler';
const args = ['pages', 'deploy', stage, '--project-name', PROJECT, '--commit-dirty=true'];
const isCmd = /\.cmd$/i.test(cmd);
const r = spawnSync(isCmd ? 'cmd.exe' : cmd, isCmd ? ['/c', cmd, ...args] : args,
  { stdio: 'inherit', cwd: ROOT, env: process.env });
if (r.status !== 0) { console.error('[portfolio] wrangler 退出码 ' + r.status); process.exit(r.status || 1); }
console.log('[portfolio] 完成 · https://' + PROJECT + '.pages.dev');
