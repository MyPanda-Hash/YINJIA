# build-hot-update.ps1 - YINJIA-MES hot update build (run on dev machine)
# Usage: powershell -File C:\INCER\YINJIA-MES\tools\build-hot-update.ps1
# Output: C:\INCER\YINJIA-MES\deploy\app.jar -> copy to server C:\yinjia\update\ then run update.bat

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root     = 'C:\INCER\YINJIA-MES'
$frontend = "$root\frontend"
$backend  = "$root\backend"
$static   = "$backend\src\main\resources\static"
$jar      = "$backend\target\app.jar"
$deploy   = "$root\deploy"
$javac    = 'C:\Program Files\Java\jdk-24\bin\javac.exe'
$jarTool  = 'C:\Program Files\Java\jdk-24\bin\jar.exe'

Write-Host '=== 1/5 Frontend build ===' -ForegroundColor Cyan
Push-Location $frontend
npm run build 2>&1 | Select-String 'built in|error' | ForEach-Object { $_.Line }
if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
Pop-Location

Write-Host '=== 2/5 Compile backend (full service + controller) ===' -ForegroundColor Cyan
$inspect = "$backend\target\jar-inspect"
if (-not (Test-Path "$inspect\BOOT-INF\lib")) {
    Write-Host '  First run: extracting fat-jar classpath...'
    New-Item -ItemType Directory $inspect -Force | Out-Null
    Push-Location $inspect
    & $jarTool xf $jar 'BOOT-INF/classes' 'BOOT-INF/lib'
    Pop-Location
}
$srcJava = "$backend\src\main\java\com\yinjia\mes"
$javaFiles = Get-ChildItem $srcJava -Recurse -Filter '*.java' | ForEach-Object { $_.FullName }
& $javac --release 17 -parameters -encoding UTF-8 -cp "$inspect\BOOT-INF\classes;$inspect\BOOT-INF\lib\*" -d "$inspect\BOOT-INF\classes" @javaFiles
if ($LASTEXITCODE -ne 0) { throw "Backend compile failed" }

Write-Host '=== 3/5 Sync dist to static ===' -ForegroundColor Cyan
Remove-Item "$static\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$frontend\dist\*" $static -Recurse -Force

Write-Host '=== 4/5 Assemble fat-jar ===' -ForegroundColor Cyan
$stage = "$backend\target\jar-hotstage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory "$stage\BOOT-INF\classes\com\yinjia\mes\service", "$stage\BOOT-INF\classes\com\yinjia\mes\controller" -Force | Out-Null
Copy-Item $static "$stage\BOOT-INF\classes\static" -Recurse -Force
Get-ChildItem "$inspect\BOOT-INF\classes\com\yinjia\mes\service" -Filter '*.class' | Copy-Item -Destination "$stage\BOOT-INF\classes\com\yinjia\mes\service" -Force
Get-ChildItem "$inspect\BOOT-INF\classes\com\yinjia\mes\controller" -Filter '*.class' | Copy-Item -Destination "$stage\BOOT-INF\classes\com\yinjia\mes\controller" -Force

# Stop local dev server (holds jar file lock)
$c = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($c) { Stop-Process -Id $c.OwningProcess -Force; Start-Sleep -Seconds 2 }
& $jarTool uf $jar -C $stage BOOT-INF
if ($LASTEXITCODE -ne 0) { throw "jar update failed" }

Write-Host '=== 5/5 Output hot update package ===' -ForegroundColor Cyan
if (-not (Test-Path $deploy)) { New-Item -ItemType Directory $deploy -Force }
Copy-Item $jar "$deploy\app.jar" -Force
$size = [math]::Round((Get-Item "$deploy\app.jar").Length / 1MB, 1)
Write-Host "  OK: $deploy\app.jar ($size MB)" -ForegroundColor Green

# Restart local dev server
Start-Process -FilePath 'C:\Program Files\Java\jdk-24\bin\java.exe' -ArgumentList '-jar', $jar -WorkingDirectory $backend -WindowStyle Hidden
Write-Host ''
Write-Host '===== HOT UPDATE PACKAGE READY =====' -ForegroundColor Yellow
Write-Host "Next: copy $deploy\app.jar to server C:\yinjia\update\ then run update.bat"
Write-Host "Server: http://36.140.66.163:8090 (RDP paste file directly)"
