# 一键部署作品集到 Cloudflare Pages
# 用法：终端执行  powershell -ExecutionPolicy Bypass -File .\deploy-cloudflare.ps1
# 前置：本机已安装 wrangler（npm i -g wrangler），且先运行过  wrangler login
# 注意：portfolio.pages.dev 已被他人占用，这里使用 portfolio-ji 作为项目名，可自行修改
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
$PROJECT = 'portfolio-ji'

Write-Host ''
Write-Host '===== 1/4 创建 Pages 项目（已存在则跳过）=====' -ForegroundColor Cyan
wrangler pages project create $PROJECT --production-branch main 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host '项目已存在或创建失败，继续部署...' -ForegroundColor Yellow }

Write-Host ''
Write-Host '===== 2/4 部署到 Cloudflare Pages =====' -ForegroundColor Cyan
wrangler pages deploy --project-name $PROJECT --branch main

Write-Host ''
Write-Host '===== 3/4 设置三角洲数据代理密钥 API_TOKEN =====' -ForegroundColor Cyan
Write-Host '将提示输入 secret 值（即你 delta-force-deploy 用的上游 API Token）'
wrangler pages secret put API_TOKEN --project-name $PROJECT

Write-Host ''
Write-Host '===== 4/4 完成 =====' -ForegroundColor Green
Write-Host ''
Write-Host '如果第 3 步失败，可手动到 Dashboard 配置：' -ForegroundColor Yellow
Write-Host "  Cloudflare → Workers & Pages → $PROJECT → Settings → Variables 添加 API_TOKEN"
Write-Host ''
Write-Host "部署后地址：https://$PROJECT.pages.dev"
Write-Host ''
Write-Host '可选增强（不配也能用）：'
Write-Host '  · D1 数据库绑定 DB（价格历史曲线数据）'
Write-Host '  · KV 命名空间绑定 METADATA_KV（自动刷新物品元数据）'
Write-Host ''
