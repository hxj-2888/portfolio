# 从 Cloudflare 旧部署恢复被 build-collect 清空的项目目录（curl -L 跟随 308）
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$BASE = 'https://69d49bc2.portfolio-ji.pages.dev/projects'
$OUT = 'C:\Users\ASUS\Desktop\portfolio\projects'

function Get-File($url, $target) {
  $tdir = Split-Path $target -Parent
  New-Item -ItemType Directory -Force -Path $tdir | Out-Null
  # 仅 HTTP 200 时写入磁盘，避免把 404 回退页存成假文件（历史教训：HTML 被存成 sw.js / manifest.json）
  $code = & curl.exe -s -L -o $target -w '%{http_code}' $url
  if ($code -ne '200') {
    if (Test-Path $target) { Remove-Item $target -Force }
    Write-Host "  [SKIP] $(Split-Path $target -Leaf) <- HTTP $code ($url)" -ForegroundColor Yellow
    return
  }
  $sz = (Get-Item $target).Length
  Write-Host "  $([IO.Path]::GetFileName($target)) ($sz B) from $url"
}

function Download-Dir($proj) {
  Write-Host "== ${proj} =="
  $dest = Join-Path $OUT $proj
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  $htmlFile = Join-Path $dest 'index.html'
  Get-File "$BASE/$proj/index.html" $htmlFile
  $c = [System.IO.File]::ReadAllText($htmlFile)

  $refs = @()
  foreach ($m in [regex]::Matches($c, '(?:src|href)="([^"]+)"')) {
    $v = $m.Groups[1].Value
    if ($v -notmatch '^(https?:|//|data:|#|about:)') { $refs += $v }
  }
  $refs += @('manifest.json', 'manifest.webmanifest', 'sw.js', 'service-worker.js')
  $refs = $refs | Select-Object -Unique | Where-Object { $_ -ne 'index.html' -and $_ -ne '' }

  foreach ($ref in $refs) {
    $path = ($ref -split '[?#]')[0]
    if ($path -eq '') { continue }
    if ($path.StartsWith('/')) { $path = $path.TrimStart('/') }
    $target = Join-Path $dest ($path -replace '/', '\')
    if (Test-Path $target) { continue }
    Get-File "$BASE/$proj/$path" $target
  }
}

Download-Dir 'delta-force'
Download-Dir 'portfolio-source'
Write-Host 'DONE'
