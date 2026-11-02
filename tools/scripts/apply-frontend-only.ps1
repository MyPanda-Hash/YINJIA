<#
  apply-frontend-only.ps1 — 只换前端发布(不动数据库、不编译后端 class)

  用途:纯前端改动(文案/版式/映射/i18n)要上线时的最短路径。
  与 build-hot-update.ps1 的区别:
    · build-hot-update.ps1 = 全量:重新编译所有后端 .java + 组装 fat-jar;
      工作区里若有别人未提交的后端改动,会被**一起编进 jar**(2026-10-21 并发会话踩过)。
    · 本脚本 = 只把 `frontend\dist` 换进 jar 的 `BOOT-INF/classes/static`,
      后端 class 原样保留 ⇒ 不会夹带未提交的后端改动,也快得多。

  做的事(与 2026-10-21 手工验证过的步骤一致):
    ① npm run build                    前端构建(可 -NoBuild 跳过)
    ② robocopy dist → static  (镜像)   仓库跟踪的部署前端来源
    ③ 停 8090 + 等 jar 句柄释放
    ④ jar uf <jar> -C <stage> BOOT-INF  只覆盖 static,**排除** BOOT-INF/classes 里其余内容
    ⑤ 起 8090 + HTTP 探活 + 打印实际下发的入口 chunk(确认不是旧包)
    ⑥ 可选 -Package:另存 deploy\app.jar,供服务器 C:\yinjia\update\ + update.bat

  用法(仓库根):
    pwsh -File tools\scripts\apply-frontend-only.ps1            # 本机 8090 立即生效
    pwsh -File tools\scripts\apply-frontend-only.ps1 -DryRun    # 只检查前置条件、打印步骤
    pwsh -File tools\scripts\apply-frontend-only.ps1 -NoBuild   # 复用已有 dist(已构建过时)
    pwsh -File tools\scripts\apply-frontend-only.ps1 -Package   # 额外产出 deploy\app.jar

  注意:
    · 必须 JDK 25+ 的 jar.exe(后端 class major 69 与 jar 工具无关,但仓库统一用 JDK25 工具链)。
    · `jar uf` 是**增量覆盖**:旧 hash 的 chunks 不会从 jar 里删除(jar 会慢慢变大,不影响运行);
      要清理就用 rebuild-prod.ps1 全量重打包。
    · 本文件需保持 **UTF-8 with BOM**(调用方可能是 Windows PowerShell 5.1,无 BOM 会把中文读成 GBK)。
#>
[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$NoBuild,
  [switch]$NoRestart,
  [switch]$Package
)

$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Global -ErrorAction SilentlyContinue) {
  $Global:PSNativeCommandUseErrorActionPreference = $false
}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$root     = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$frontend = Join-Path $root 'frontend'
$static   = Join-Path $root 'backend\src\main\resources\static'
$jar      = Join-Path $root 'backend\target\yinjia-mes-backend-0.1.0.jar'
$deploy   = Join-Path $root 'deploy'
Set-Location $root

function Step($n, $msg) { Write-Host "=== $n $msg ===" -ForegroundColor Cyan }

# ---- JDK 25+ 探测(jar.exe)----
function Test-Jdk25([string]$h) {
  if (-not $h) { return $false }
  $jarExe = Join-Path $h 'bin\jar.exe'
  $release = Join-Path $h 'release'
  if (-not (Test-Path $jarExe) -or -not (Test-Path $release)) { return $false }
  $m = Select-String -Path $release -Pattern '^JAVA_VERSION="([0-9]+)' | Select-Object -First 1
  return ($m -and [int]$m.Matches[0].Groups[1].Value -ge 25)
}
$jdk = $null
$cands = @()
if ($env:JAVA_HOME) { $cands += $env:JAVA_HOME.TrimEnd('\') }
foreach ($d in @("$env:USERPROFILE\.jdks", 'C:\Program Files\Java', 'D:\Program Files\Java')) {
  if (Test-Path $d) { $cands += (Get-ChildItem -Path $d -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }) }
}
$jdk = $cands | Where-Object { Test-Jdk25 $_ } | Select-Object -First 1
if (-not $jdk) { throw '未找到 JDK 25+(需要 jar.exe):请设 JAVA_HOME 指向 JDK 25' }
$jarExe = Join-Path $jdk 'bin\jar.exe'
Write-Host "JDK25: $jdk" -ForegroundColor DarkGray

# ---- 前置检查(缺什么当场说清,别跑到一半才炸)----
$problems = @()
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) { $problems += "前端依赖未安装: $(Join-Path $frontend 'node_modules')" }
if (-not (Test-Path $jar)) { $problems += "正式实例 jar 不存在: $jar(先跑一次 rebuild-prod.ps1 或 build-appjar.ps1)" }
if (-not $NoBuild -and -not $DryRun -and -not (Test-Path (Join-Path $frontend 'node_modules\vite\bin\vite.js'))) { $problems += '缺少 vite(前端 node_modules 不完整)' }
if ($problems.Count) { $problems | ForEach-Object { Write-Host "[X] $_" -ForegroundColor Red }; throw '前置检查未通过' }

$tagBuild   = if ($NoBuild) { '跳过' } else { '执行' }
$tagRestart = if ($NoRestart) { '跳过' } else { '执行' }
$tagPkg     = if ($Package) { '执行' } else { '跳过' }
$plan = @(
  "$tagBuild ① npm run build"
  '② robocopy dist → backend\src\main\resources\static (镜像)'
  '③ 停 8090 + 等 jar 句柄释放'
  '④ jar uf 只覆盖 BOOT-INF/classes/static'
  "$tagRestart ⑤ 起 8090 + HTTP 探活 + 校验入口 chunk"
  "$tagPkg ⑥ 产出 deploy\app.jar"
)
Write-Host '将要执行:' -ForegroundColor Yellow
$plan | ForEach-Object { Write-Host "  - $_" }
if ($DryRun) { Write-Host '[DryRun] 到此为止,未改动任何文件/进程。' -ForegroundColor Yellow; exit 0 }

# ---- ① 前端构建 ----
if (-not $NoBuild) {
  Step '1/5' '前端构建 (npm run build)'
  Push-Location $frontend
  try {
    # 构建器输出量大且会混 stderr(rollup 警告);失败以 exit code 判定,不让警告中断流程
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = @(npm run build 2>&1)
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    $out | ForEach-Object { "$_" } | Select-String 'built in|error|ERROR' | ForEach-Object { $_.Line }
    if ($code -ne 0) { throw "前端构建失败(exit=$code)" }
  } finally { Pop-Location }
} else {
  Step '1/5' '前端构建(已按 -NoBuild 跳过)'
}
if (-not (Test-Path (Join-Path $frontend 'dist\index.html'))) { throw 'dist\index.html 不存在,前端未构建' }

# ---- ② dist → static(镜像:与部署包内容严格一致)----
Step '2/5' '同步 dist → 后端 static(镜像)'
robocopy (Join-Path $frontend 'dist') $static /MIR /NFL /NDL /NJH /NJS /R:1 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy 同步失败(exit=$LASTEXITCODE)" }
Write-Host '  static 已同步' -ForegroundColor DarkGray

# ---- ③ 停服务 + 等 jar 句柄 ----
if (-not $NoRestart) {
  Step '3/5' '停 8090(等 jar 句柄释放)'
  & (Join-Path $PSScriptRoot 'start-prod.ps1') -Stop | Out-Null
} else {
  Step '3/5' '停 8090(已按 -NoRestart 跳过:jar 若被占用,下一步会失败)'
}
$free = $false
for ($i = 0; $i -lt 60; $i++) {
  try { $fs = [System.IO.File]::Open($jar, 'Open', 'ReadWrite', 'None'); $fs.Close(); $fs.Dispose(); $free = $true; break }
  catch { Start-Sleep -Seconds 1 }
}
if (-not $free) { throw "等待 jar 句柄释放超时(60s):$jar 仍被占用" }
Write-Host '  jar 已可独占写入' -ForegroundColor DarkGray

# ---- ④ 只覆盖 static ----
Step '4/5' '更新 jar 内的 static(后端 class 不动)'
$stage = Join-Path $env:TEMP ("yj-static-stage-" + [guid]::NewGuid().ToString('N'))
try {
  New-Item -ItemType Directory -Force (Join-Path $stage 'BOOT-INF\classes') | Out-Null
  Copy-Item $static (Join-Path $stage 'BOOT-INF\classes\static') -Recurse -Force
  & $jarExe uf $jar -C $stage BOOT-INF
  if ($LASTEXITCODE -ne 0) { throw "jar uf 失败(exit=$LASTEXITCODE)" }
} finally {
  Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
}
$entry = ([regex]::Match((Get-Content (Join-Path $static 'index.html') -Raw), 'assets/index-[A-Za-z0-9_-]+\.js')).Value
Write-Host "  入口 chunk: $entry" -ForegroundColor DarkGray

# ---- ⑤ 起服务 + 探活 + 校验实际下发的入口 chunk ----
if (-not $NoRestart) {
  Step '5/5' '启动 8090 + 探活'
  & (Join-Path $PSScriptRoot 'start-prod.ps1')
  $ok = $false
  for ($i = 0; $i -lt 90; $i++) {
    try {
      $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8090/' -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -eq 200) { $ok = $true; $served = $r.Content; break }
    } catch { }
    Start-Sleep -Seconds 1
  }
  if (-not $ok) { throw '8090 启动后 90s 内未响应,请查后台窗口/日志' }
  if ($entry -and $served -notmatch [regex]::Escape($entry)) {
    throw "8090 已响应,但下发的不是新入口($entry)—— 可能读到旧 jar/旧进程,请复核"
  }
  Write-Host "  [OK] http://127.0.0.1:8090 已下发 $entry" -ForegroundColor Green
} else {
  Step '5/5' '启动 8090(已按 -NoRestart 跳过)'
}

# ---- ⑥ 可选:产出服务器热更新包 ----
if ($Package) {
  if (-not (Test-Path $deploy)) { New-Item -ItemType Directory $deploy -Force | Out-Null }
  Copy-Item $jar (Join-Path $deploy 'app.jar') -Force
  $mb = [math]::Round((Get-Item (Join-Path $deploy 'app.jar')).Length / 1MB, 1)
  Write-Host "[Package] 已产出 deploy\app.jar ($mb MB) → 粘贴到服务器 C:\yinjia\update\ 后双击 update.bat" -ForegroundColor Yellow
}

Write-Host ''
Write-Host '===== 前端发布完成 =====' -ForegroundColor Yellow
