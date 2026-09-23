# _qa-deploy-static.ps1 — 前端-only 热更到 fat jar(不编译 Java:并行会话的后端改动不入包)
# 前置:已 npm run build 且把 frontend/dist/* 同步到 backend/src/main/resources/static
param([string]$Root = 'D:\YINJIA-main')
$ErrorActionPreference = 'Stop'
$static = Join-Path $Root 'backend\src\main\resources\static'
$jar = Join-Path $Root 'backend\target\yinjia-mes-backend-0.1.0.jar'
$jarTool = 'C:\Program Files\Java\jdk-26.0.2\bin\jar.exe'
$java = 'C:\Program Files\Java\jdk-26.0.2\bin\java.exe'
$stage = Join-Path $Root 'backend\target\jar-static-stage'

if (-not (Test-Path (Join-Path $static 'index.html'))) { throw "static 未就绪:$static" }

$c = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($c) { Write-Output ("stopping pid " + $c.OwningProcess); Stop-Process -Id $c.OwningProcess -Force; Start-Sleep -Seconds 3 }
else { Write-Output 'port 8090 not listening' }

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory (Join-Path $stage 'BOOT-INF\classes') -Force | Out-Null
Copy-Item $static (Join-Path $stage 'BOOT-INF\classes\static') -Recurse -Force
Push-Location $stage
& $jarTool uf $jar 'BOOT-INF'
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "jar update failed ($code)" }
Write-Output 'jar static updated'

$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ('"' + $java + '" -jar ' + $jar); CurrentDirectory = $Root }
Write-Output ('wmi start returnValue=' + $r.ReturnValue + ' pid=' + $r.ProcessId)
