# build-hot-update.ps1 — YINJIA-MES 热更新一键打包(本地开发机执行)
# 用法: pwsh -File C:\INCER\YINJIA-MES\tools\build-hot-update.ps1
# 产出: C:\INCER\YINJIA-MES\deploy\app.jar (复制到服务器 C:\yinjia\update\ 后双击 update.bat)
# 前提: 前端 npm run build 通过; 后端 javac 编译通过的最新源码

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

Write-Host '=== 1/5 前端构建 ===' -ForegroundColor Cyan
Push-Location $frontend
npm run build 2>&1 | Select-String 'built in|error' | ForEach-Object { $_.Line }
if ($LASTEXITCODE -ne 0) { throw "前端构建失败" }
Pop-Location

Write-Host '=== 2/5 编译后端(全量 service + controller) ===' -ForegroundColor Cyan
$inspect = "$backend\target\jar-inspect"
if (-not (Test-Path "$inspect\BOOT-INF\lib")) {
    Write-Host '  首次:解包 fat-jar 提取 classpath...'
    New-Item -ItemType Directory $inspect -Force | Out-Null
    Push-Location $inspect
    & $jarTool xf $jar 'BOOT-INF/classes' 'BOOT-INF/lib'
    Pop-Location
}
$srcJava = "$backend\src\main\java\com\yinjia\mes"
$javaFiles = Get-ChildItem $srcJava -Recurse -Filter '*.java' | ForEach-Object { $_.FullName }
& $javac --release 17 -parameters -encoding UTF-8 `
    -cp "$inspect\BOOT-INF\classes;$inspect\BOOT-INF\lib\*" `
    -d "$inspect\BOOT-INF\classes" @javaFiles
if ($LASTEXITCODE -ne 0) { throw "后端编译失败" }

Write-Host '=== 3/5 同步 static → src ===' -ForegroundColor Cyan
Remove-Item "$static\*" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$frontend\dist\*" $static -Recurse -Force

Write-Host '=== 4/5 组装修 fat-jar ===' -ForegroundColor Cyan
$stage = "$backend\target\jar-hotstage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory "$stage\BOOT-INF\classes\com\yinjia\mes\service", "$stage\BOOT-INF\classes\com\yinjia\mes\controller" -Force | Out-Null
Copy-Item $static "$stage\BOOT-INF\classes\static" -Recurse -Force
Get-ChildItem "$inspect\BOOT-INF\classes\com\yinjia\mes\service" -Filter '*.class' |
    Copy-Item -Destination "$stage\BOOT-INF\classes\com\yinjia\mes\service" -Force
Get-ChildItem "$inspect\BOOT-INF\classes\com\yinjia\mes\controller" -Filter '*.class' |
    Copy-Item -Destination "$stage\BOOT-INF\classes\com\yinjia\mes\controller" -Force

# 停本地开发服务(占用 jar 文件锁)
$c = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($c) { Stop-Process -Id $c.OwningProcess -Force; Start-Sleep -Seconds 2 }
& $jarTool uf $jar -C $stage BOOT-INF
if ($LASTEXITCODE -ne 0) { throw "jar 更新失败" }

Write-Host '=== 5/5 输出热更新包 ===' -ForegroundColor Cyan
if (-not (Test-Path $deploy)) { New-Item -ItemType Directory $deploy -Force }
Copy-Item $jar "$deploy\app.jar" -Force
$size = [math]::Round((Get-Item "$deploy\app.jar").Length / 1MB, 1)
Write-Host "  ✓ $deploy\app.jar ($size MB)" -ForegroundColor Green

# 重启本地开发服务
Start-Process -FilePath 'C:\Program Files\Java\jdk-24\bin\java.exe' `
    -ArgumentList '-jar', $jar -WorkingDirectory $backend -WindowStyle Hidden
Write-Host ''
Write-Host '━━━ 热更新包就绪 ━━━' -ForegroundColor Yellow
Write-Host "下一步: 把 $deploy\app.jar 复制到服务器 C:\yinjia\update\ 然后双击 update.bat"
Write-Host "服务器地址: http://36.140.66.163:8090 (RDP 远程桌面直接粘贴文件)"
