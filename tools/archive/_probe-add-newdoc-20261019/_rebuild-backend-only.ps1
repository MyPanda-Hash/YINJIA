# 只重打后端 class(前端 static 保持仓库 HEAD 原样,不跑 robocopy /MIR)
#
# 背景:rebuild-prod.ps1 -SkipFrontend 仍会把 frontend\dist 镜像到 backend\...\static。
# 本机 dist 是旧构建,一镜像就把仓库里较新的 static 删了一批(chunk 哈希不同)——
# 前端一个字节都不该动的时候,走这个脚本:停 → mvn package(用仓库里的 static)→ 起。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
Set-Location $root
$jar = Join-Path $root 'backend\target\yinjia-mes-backend-0.1.0.jar'

Write-Host '[1/3] 停 8090 ...'
& (Join-Path $root 'tools\scripts\start-prod.ps1') -Stop | Out-Null

Write-Host '[2/3] 等 jar 句柄释放 ...'
for ($i = 0; $i -lt 60; $i++) {
    $busy = Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'yinjia-mes-backend' }
    $free = $true
    if (Test-Path $jar) {
        try { $fs = [System.IO.File]::Open($jar, 'Open', 'ReadWrite', 'None'); $fs.Close(); $fs.Dispose() }
        catch { $free = $false }
    }
    if (-not $busy -and $free) { break }
    Start-Sleep -Seconds 1
}
Remove-Item (Join-Path $root 'backend\target\*.jar.original') -Force -ErrorAction SilentlyContinue

Write-Host '[3/3] mvn package(不碰前端 static)...'
$env:JAVA_HOME = "$env:USERPROFILE\.jdks\ms-25.0.4"
$env:YINJIA_M2_REPO = "$root\.m2-repo"
& "$root\tools\apache-maven-3.9.9\bin\mvn.cmd" -q -s "$root\tools\settings.xml" -f "$root\backend\pom.xml" -DskipTests package
if ($LASTEXITCODE -ne 0) { throw "mvn package 失败(exit=$LASTEXITCODE)" }
$libCnt = (& "$env:JAVA_HOME\bin\jar.exe" tf $jar 2>$null | Select-String 'BOOT-INF/lib/' | Measure-Object).Count
Write-Host "      fat jar 自检:BOOT-INF/lib = $libCnt 条"
if ($libCnt -lt 50) { throw "打包产物不是 fat jar" }
& (Join-Path $root 'tools\scripts\start-prod.ps1')
Write-Host '完成。'
