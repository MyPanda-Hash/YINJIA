# build-hot-update.ps1 - YINJIA-MES hot update build (run on dev machine)
# Usage: powershell -File C:\INCER\YINJIA-MES\tools\scripts\build-hot-update.ps1
# Prereq: JDK 25 (JAVA_HOME or one of the standard install dirs; see the JDK detection below)
# Output: C:\INCER\YINJIA-MES\deploy\app.jar -> copy to server C:\yinjia\update\ then run update.bat

$ErrorActionPreference = 'Stop'
# PS7.4+: native stderr warnings (e.g. rollup) must not terminate under EAP=Stop
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Global -ErrorAction SilentlyContinue) {
    $Global:PSNativeCommandUseErrorActionPreference = $false
}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root     = 'C:\INCER\YINJIA-MES'
$frontend = "$root\frontend"
$backend  = "$root\backend"
$static   = "$backend\src\main\resources\static"
$jar      = "$backend\target\app.jar"
$deploy   = "$root\deploy"

# JDK 探测(与 build-appjar.ps1 / 各 .bat 同一模式):JAVA_HOME → 常见安装目录 → 明确报错。
# 2026-09-22:原先三处硬编码 'C:\Program Files\Java\jdk-24\bin\…',本机 JDK 已是 25,
# 硬编码在换版本后必挂;改为探测并统一从 JAVA_HOME 取(javac/jar/java 三个都要)。
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\javac.exe")) {
    foreach ($cand in @('C:\Program Files\Java\jdk-25', 'D:\Program Files\Java\jdk-25', "$env:USERPROFILE\.jdk\jdk-25\jdk-25.0.2")) {
        if (Test-Path "$cand\bin\javac.exe") { $env:JAVA_HOME = $cand; break }
    }
}
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\javac.exe")) {
    throw "未找到 JDK 25:请设 JAVA_HOME 指向 JDK 25(候选:C:\Program Files\Java\jdk-25 / $env:USERPROFILE\.jdk\jdk-25\jdk-25.0.2)"
}
$javac   = "$env:JAVA_HOME\bin\javac.exe"
$jarTool = "$env:JAVA_HOME\bin\jar.exe"
$javaExe = "$env:JAVA_HOME\bin\java.exe"
Write-Host "JDK: $env:JAVA_HOME" -ForegroundColor DarkGray

Write-Host '=== 1/5 Frontend build ===' -ForegroundColor Cyan
Push-Location $frontend
# native stderr (rollup warnings) becomes terminating ErrorRecords under EAP=Stop on PS5.1 -> lower it locally
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$npmOut = @(npm run build 2>&1)
$npmExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap
$npmOut | ForEach-Object { "$_" } | Select-String 'built in|error' | ForEach-Object { $_.Line }
if ($npmExit -ne 0) { throw "Frontend build failed" }
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
& $javac --release 25 -parameters -encoding UTF-8 -cp "$inspect\BOOT-INF\classes;$inspect\BOOT-INF\lib\*" -d "$inspect\BOOT-INF\classes" @javaFiles
if ($LASTEXITCODE -ne 0) { throw "Backend compile failed" }

Write-Host '=== 3/5 Sync dist to static ===' -ForegroundColor Cyan
Remove-Item "$static\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$frontend\dist\*" $static -Recurse -Force

Write-Host '=== 4/5 Assemble fat-jar ===' -ForegroundColor Cyan
$stage = "$backend\target\jar-hotstage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory "$stage\BOOT-INF\classes\com\yinjia\mes\service", "$stage\BOOT-INF\classes\com\yinjia\mes\controller", "$stage\BOOT-INF\classes\com\yinjia\mes\config" -Force | Out-Null
Copy-Item $static "$stage\BOOT-INF\classes\static" -Recurse -Force
Get-ChildItem "$inspect\BOOT-INF\classes\com\yinjia\mes\service" -Filter '*.class' | Copy-Item -Destination "$stage\BOOT-INF\classes\com\yinjia\mes\service" -Force
Get-ChildItem "$inspect\BOOT-INF\classes\com\yinjia\mes\controller" -Filter '*.class' | Copy-Item -Destination "$stage\BOOT-INF\classes\com\yinjia\mes\controller" -Force
Get-ChildItem "$inspect\BOOT-INF\classes\com\yinjia\mes\config" -Filter '*.class' | Copy-Item -Destination "$stage\BOOT-INF\classes\com\yinjia\mes\config" -Force

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
Start-Process -FilePath $javaExe -ArgumentList '-jar', $jar -WorkingDirectory $backend -WindowStyle Hidden
Write-Host ''
Write-Host '===== HOT UPDATE PACKAGE READY =====' -ForegroundColor Yellow
Write-Host "Next: copy $deploy\app.jar to server C:\yinjia\update\ then run update.bat"
Write-Host "Server: http://36.140.66.163:8090 (RDP paste file directly)"
