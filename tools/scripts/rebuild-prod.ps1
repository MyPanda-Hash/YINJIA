# rebuild-prod.ps1 — 停正式实例 → 等文件句柄释放 → 打包 → 重启
#
# 为什么需要这个:8090 跑的就是 `backend\target\yinjia-mes-backend-0.1.0.jar`,
# 而 maven 的 repackage 要把该文件重命名成 `.jar.original` ⇒ **服务没停干净就必然报**
#   `Unable to rename ...jar to ...jar.original`
# 而 Stop-Process 之后 Windows 释放文件句柄有延迟(杀进程返回 ≠ 句柄已释放),
# 实测偶发要等十几秒;单次 kill + 固定 sleep 会间歇性失败(2026-10-15 连踩两次)。
# 本脚本的做法:轮询"进程没了 + jar 能独占打开"两个条件都满足,再打包。
#
# 用法(仓库根):
#   powershell -ExecutionPolicy Bypass -File tools\scripts\rebuild-prod.ps1
#   powershell -ExecutionPolicy Bypass -File tools\scripts\rebuild-prod.ps1 -SkipFrontend
param([switch]$SkipFrontend)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root
$jar = Join-Path $root 'backend\target\yinjia-mes-backend-0.1.0.jar'

function Get-MesProcs {
    Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'yinjia-mes' }
}

# 🔴 关键:`backend\start-backend.bat` 里是个**重启循环**
#   (:loop → java -jar … → "Restarting in 5 seconds" → goto loop)
#   所以**只杀 java 进程没用** —— 5 秒后监督它的 cmd.exe 会把 java 再拉起来、重新占住 jar,
#   maven repackage 的改名随即失败(2026-10-15 实测:先报"jar 可独占打开",几秒后打包又挂)。
#   必须先杀监督进程(cmd.exe 跑 start-backend.bat),再杀 java。
function Get-MesSupervisors {
    Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'start-backend\.bat' }
}

Write-Host '[1/4] 停正式实例 + 停掉它的重启监督进程 ...'
& (Join-Path $PSScriptRoot 'start-prod.ps1') -Stop | Out-Null

Write-Host '[2/4] 等进程退出 + jar 句柄释放 ...'
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
    $sup = Get-MesSupervisors
    if ($sup) { $sup | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }
    $procs = Get-MesProcs
    if ($procs) { $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }
    $free = $true
    if (Test-Path $jar) {
        try {
            $fs = [System.IO.File]::Open($jar, 'Open', 'ReadWrite', 'None')
            $fs.Close(); $fs.Dispose()
        } catch { $free = $false }
    }
    if (-not $procs -and -not $sup -and $free) { $ok = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ok) { throw "等待 jar 句柄释放超时(60s):$jar 仍被占用" }
Write-Host "      进程已退出、jar 可独占打开(等了 $i 秒)"
Remove-Item (Join-Path $root 'backend\target\*.jar.original') -Force -ErrorAction SilentlyContinue

Write-Host '[3/4] 打包 ...'
# ⚠ 不用 splat/自动变量 $args —— 实测 `& script @arr` 会把 -SkipFrontend 当**位置参数**报
#   「A positional parameter cannot be found」;直接两条分支调用最稳。
if ($SkipFrontend) { & (Join-Path $root 'build-appjar.ps1') -SkipFrontend }
else               { & (Join-Path $root 'build-appjar.ps1') }
if ($LASTEXITCODE -ne 0) { throw "build-appjar 失败(exit=$LASTEXITCODE)" }

# fat jar 自检:repackage 失败时磁盘上会留一个**瘦 jar**(~15MB、没有 BOOT-INF/lib),
# 服务在内存里跑着看似正常,但一重启就起不来(build-appjar.ps1 头部有同样的警告)。
$libCnt = (& jar tf $jar 2>$null | Select-String 'BOOT-INF/lib/' | Measure-Object).Count
Write-Host "      fat jar 自检:BOOT-INF/lib = $libCnt 条"
if ($libCnt -lt 50) { throw "打包产物不是 fat jar(BOOT-INF/lib 仅 $libCnt 条)⇒ repackage 很可能失败过,不要用它重启" }

Write-Host '[4/4] 重启 ...'
& (Join-Path $PSScriptRoot 'start-prod.ps1')
Write-Host '完成。'
