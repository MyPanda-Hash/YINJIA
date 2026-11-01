# stop-service-then-rebuild.ps1 —— 先停掉占用 jar 的 8090 实例,再立即重新打包并重启(2026-11-01)
# 背景:另一个并行会话的工具调用在本机又拉起了一个 javaw(监听 8090,占用 target jar),
#       导致 mvn clean 无法删除 jar。这里在同一次调用里"杀进程 → 立刻构建 → 由 rebuild-prod 重启"。
$ErrorActionPreference = 'Continue'
# 1) 杀掉所有以 target\yinjia-mes-backend-0.1.0.jar 启动的 java/javaw(无论谁起的)
$procs = Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -eq 'java.exe' -or $_.Name -eq 'javaw.exe') -and
    ($_.CommandLine -match 'yinjia-mes-backend')
}
foreach ($p in $procs) {
    Write-Host ("[kill] {0} pid={1}" -f $p.Name, $p.ProcessId)
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2
# 2) 等 jar 可独占打开(最多 30s)
$jar = 'D:\workspace\yinjia\backend\target\yinjia-mes-backend-0.1.0.jar'
for ($i = 0; $i -lt 30; $i++) {
    $free = $true
    if (Test-Path $jar) {
        try { $fs = [System.IO.File]::Open($jar, 'Open', 'ReadWrite', 'None'); $fs.Close(); $fs.Dispose() }
        catch { $free = $false }
    }
    if ($free) { Write-Host ("[jar] 可独占打开(等了 {0}s)" -f $i); break }
    Start-Sleep -Seconds 1
}
if (-not $free) { Write-Host '[jar] 仍被占用,构建大概率失败'; }
# 3) 立即重新打包 + 重启(rebuild-prod.ps1 内部会 npm build + mvn clean package + 起 8090)
Set-Location 'D:\workspace\yinjia'
& powershell -ExecutionPolicy Bypass -File 'D:\workspace\yinjia\tools\scripts\rebuild-prod.ps1' 2>&1 |
    Tee-Object -FilePath 'D:\workspace\yinjia\.tmp\rebuild-oqc-10-20261101.log' | Out-String
