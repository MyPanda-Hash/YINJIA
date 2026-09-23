# _deploy-static-only.ps1 — 前端-only 热更:构建前端 → 同步 dist 到 static → 仅更新 app.jar 的 static(不编译 Java,避开并行会话的 JasperReports 半成品)
$ErrorActionPreference = 'Stop'
Set-Location C:\INCER\YINJIA-MES
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$npmOut = @(npm --prefix frontend run build 2>&1)
$npmExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap
$npmOut | Select-String 'built in|error' | ForEach-Object { $_.Line }
if ($npmExit -ne 0) { throw "frontend build failed" }
$static = 'backend\src\main\resources\static'
Remove-Item "$static\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item 'frontend\dist\*' $static -Recurse -Force
$jar = 'backend\target\app.jar'
# JDK 探测(2026-09-22:原先两处硬编码 'C:\Program Files\Java\jdk-24\bin\…',换 JDK 版本后必挂)
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\jar.exe")) {
  foreach ($cand in @('C:\Program Files\Java\jdk-25', 'D:\Program Files\Java\jdk-25', "$env:USERPROFILE\.jdk\jdk-25\jdk-25.0.2")) {
    if (Test-Path "$cand\bin\jar.exe") { $env:JAVA_HOME = $cand; break }
  }
}
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\jar.exe")) {
  throw "未找到 JDK 25:请设 JAVA_HOME 指向 JDK 25(候选:C:\Program Files\Java\jdk-25 / $env:USERPROFILE\.jdk\jdk-25\jdk-25.0.2)"
}
$jarTool = "$env:JAVA_HOME\bin\jar.exe"
$javaExe = "$env:JAVA_HOME\bin\java.exe"
$stage = 'backend\target\jar-static-stage'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory "$stage\BOOT-INF\classes" -Force | Out-Null
Copy-Item $static "$stage\BOOT-INF\classes\static" -Recurse -Force
$c = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($c) { Stop-Process -Id $c.OwningProcess -Force; Start-Sleep -Seconds 2 }
Push-Location $stage
& $jarTool uf 'C:\INCER\YINJIA-MES\backend\target\app.jar' 'BOOT-INF'
Pop-Location
if ($LASTEXITCODE -ne 0) { throw 'jar update failed' }
Start-Process -FilePath $javaExe -ArgumentList '-jar', 'C:\INCER\YINJIA-MES\backend\target\app.jar' -WorkingDirectory 'C:\INCER\YINJIA-MES\backend' -WindowStyle Hidden
Write-Host 'static-only deploy done, server restarting'
