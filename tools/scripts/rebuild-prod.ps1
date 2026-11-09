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
# 打包前先记下旧 jar 的指纹与时间:下面必须**真的换了包**才算成功(2026-11-09 实测踩到 ——
#   脚本一路打印「打包 OK」,磁盘上却还是上一次的 jar:服务被重启了,跑的还是旧 class/旧前端,
#   界面表现"改了没生效",而日志没有任何报错)。判据用**时间**(mvn 重写 ⇒ 一定晚于本次开工),
#   不单看哈希(同样的源码重复打包,哈希也可能恰好相同,那是合法情况)。
$jarHashBefore = if (Test-Path $jar) { (Get-FileHash $jar -Algorithm SHA256).Hash } else { '' }
$buildStart = Get-Date
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
# ⚠ `jar` 未必在 PATH 上(本机实测:JAVA_HOME 指向 JDK 25,但 PATH 里没有它的 bin)——
#   直接 `& jar tf` 会报 CommandNotFoundException,**打包成功却卡在自检、服务不会被重启**。
#   一律走 $env:JAVA_HOME\bin\jar.exe(PATH 上没有就回退到 PATH 上的 jar)。
$jarExe = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\jar.exe")) { "$env:JAVA_HOME\bin\jar.exe" } else { 'jar' }
$libCnt = (& $jarExe tf $jar 2>$null | Select-String 'BOOT-INF/lib/' | Measure-Object).Count
Write-Host "      fat jar 自检:BOOT-INF/lib = $libCnt 条"
if ($libCnt -lt 50) { throw "打包产物不是 fat jar(BOOT-INF/lib 仅 $libCnt 条)⇒ repackage 很可能失败过,不要用它重启" }

# 换包自检:jar 必须**被 mvn 重写过**(文件时间晚于本次开工)。没被重写说明 mvn 那步没落地
# (打了别的目录 / 静默跳过 / clean 没删掉旧包),此时重启等于"用旧包冒充新包"。
# 2026-11-09 实测这条是**偶发**的:同一条 mvn 命令、同一目录,5 次里 2 次没换包却退出 0
# ⇒ 先自动重打一次(偶发时基本一次就好),仍不换包才失败,别让一次抖动把服务留在停机状态。
$jarTimeAfter = (Get-Item $jar).LastWriteTime
if ($jarTimeAfter -lt $buildStart) {
    Write-Host "      [WARN] 打包产物没被重写(仍是 $jarTimeAfter),自动重打一次 ..." -ForegroundColor Yellow
    if ($SkipFrontend) { & (Join-Path $root 'build-appjar.ps1') -SkipFrontend }
    else               { & (Join-Path $root 'build-appjar.ps1') }
    $jarTimeAfter = (Get-Item $jar).LastWriteTime
}
if ($jarTimeAfter -lt $buildStart) {
    throw "打包产物没被重写(jar 时间 $jarTimeAfter 早于本次开工 $buildStart):mvn 没有真正换包(不是代码没改,是包没生成)。请检查 build-appjar.ps1 的 mvn 输出后重试,不要用这个 jar 重启。"
}
$jarHashAfter = (Get-FileHash $jar -Algorithm SHA256).Hash
Write-Host "      换包自检:jar 已重写($jarTimeAfter)$(if ($jarHashBefore) { ",哈希 $($jarHashBefore.Substring(0,8))… → $($jarHashAfter.Substring(0,8))…" })"

Write-Host '[4/4] 重启 ...'
& (Join-Path $PSScriptRoot 'start-prod.ps1')
Write-Host '完成。'
