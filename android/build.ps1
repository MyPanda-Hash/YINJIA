# build.ps1 — 不用 Gradle,直接用 Android SDK 的 build-tools 打出 APK(2026-10-20)
#
# 为什么手搓而不上 Gradle:本机没有 Gradle、也没有 Android Studio(Gradle 首次运行还要联网拉
#   插件与依赖)。这个壳只有 2 个 Activity + 1 个 ZXing jar,用 aapt2 / javac / d8 / apksigner
#   四步就够,几十秒出包,离线也能重复构建。
#
# 用法(仓库根):
#   powershell -ExecutionPolicy Bypass -File android\build.ps1            # 出包
#   powershell -ExecutionPolicy Bypass -File android\build.ps1 -Install   # 出包并 adb 安装到已连的手机
#
# 产物:android\dist\yinjia-mes-<version>.apk(debug 签名,可直接侧载)
param([switch]$Install)

$ErrorActionPreference = 'Stop'
# $PSScriptRoot 在个别调用方式(如 `powershell -File` + 老版本宿主)下会是空 ⇒ 回退到 MyCommand
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
$root = Split-Path -Parent $here               # 仓库根
$proj = $here                                   # android/
$app  = Join-Path $proj 'app'
$build = Join-Path $proj 'build'
$dist  = Join-Path $proj 'dist'

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path $sdk)) { throw "找不到 Android SDK:$sdk(设 ANDROID_HOME)" }
$bt = Join-Path $sdk 'build-tools\34.0.0'
# d8 单独取新版:34.0.0 自带的 d8(8.2.2)在 JDK 25 上会 NPE 崩溃(实测),36.1.0 正常
$btD8 = @('36.1.0','37.0.0','34.0.0') | ForEach-Object { Join-Path $sdk "build-tools\$_" } | Where-Object { Test-Path (Join-Path $_ 'd8.bat') } | Select-Object -First 1
if (-not $btD8) { throw '找不到可用的 d8(build-tools)' }
if (-not (Test-Path $bt)) { throw "找不到 build-tools 34.0.0:$bt" }
$androidJar = Join-Path $sdk 'platforms\android-34\android.jar'
if (-not (Test-Path $androidJar)) { throw "找不到 android-34 平台:$androidJar" }

# JDK:优先 JAVA_HOME,其次 JDK 25 常见路径(与仓库其它脚本同一套探测)
$javaHome = $env:JAVA_HOME
if (-not $javaHome -or -not (Test-Path (Join-Path $javaHome 'bin\javac.exe'))) {
  foreach ($c in @("$env:USERPROFILE\.jdks\temurin-25.0.4.1", "$env:USERPROFILE\.jdks\ms-25.0.4", 'C:\Program Files\Java\jdk-25', 'D:\Program Files\Java\jdk-25')) {
    if (Test-Path (Join-Path $c 'bin\javac.exe')) { $javaHome = $c; break }
  }
}
if (-not $javaHome) { throw '找不到 JDK 25(设 JAVA_HOME)' }

$version = '1.0.0'
$zxing = Join-Path $proj 'libs\zxing-core-3.5.3.jar'
if (-not (Test-Path $zxing)) { throw "缺少 ZXing:$zxing(可从 Maven Central 下 core-3.5.3.jar)" }

# ① 整个前端打进 APK(2026-10-20 第二轮,用户口径「需要你将整个系统打包过去」)
#    assets/www = frontend/dist 的完整镜像;aapt2 link 时用 -A 打进去,WebView 从
#    file:///android_asset/www/index.html 加载 ⇒ 断网/服务器没开也能开界面。
$webDist = Join-Path $root 'frontend\dist'
$www = Join-Path $app 'assets\www'
if (-not (Test-Path $webDist)) { throw "没有前端产物:$webDist —— 先 cd frontend; npm run build" }
Write-Host '[1/7] 收进前端产物(assets\www)'
if (Test-Path $www) { Remove-Item $www -Recurse -Force }
New-Item -ItemType Directory -Force -Path $www | Out-Null
Copy-Item (Join-Path $webDist '*') $www -Recurse -Force
$wwwFiles = (Get-ChildItem $www -Recurse -File).Count
$wwwKb = [Math]::Round(((Get-ChildItem $www -Recurse -File | Measure-Object Length -Sum).Sum) / 1KB, 0)
Write-Host ("      {0} 个文件 / {1} KB" -f $wwwFiles, $wwwKb)

Write-Host '[2/7] 清理 + 资源编译(aapt2 compile)'
if (Test-Path $build) { Remove-Item $build -Recurse -Force }
New-Item -ItemType Directory -Force -Path $build, (Join-Path $build 'gen'), (Join-Path $build 'classes'), (Join-Path $build 'dex') | Out-Null
& "$bt\aapt2.exe" compile --dir (Join-Path $app 'res') -o (Join-Path $build 'res.zip')
if ($LASTEXITCODE -ne 0) { throw 'aapt2 compile 失败' }

Write-Host '[3/7] 资源链接 + 生成 R.java(aapt2 link)'
& "$bt\aapt2.exe" link -o (Join-Path $build 'base.apk') -I $androidJar `
  --manifest (Join-Path $app 'AndroidManifest.xml') `
  -R (Join-Path $build 'res.zip') `
  --java (Join-Path $build 'gen') `
  --min-sdk-version 24 --target-sdk-version 34 `
  --version-code 1 --version-name $version --auto-add-overlay
if ($LASTEXITCODE -ne 0) { throw 'aapt2 link 失败' }

Write-Host '[4/7] 编译 Java(javac)'
$sources = @()
$sources += (Get-ChildItem (Join-Path $app 'src') -Recurse -Filter *.java | Select-Object -ExpandProperty FullName)
$sources += (Get-ChildItem (Join-Path $build 'gen') -Recurse -Filter *.java | Select-Object -ExpandProperty FullName)
& "$javaHome\bin\javac.exe" -encoding UTF-8 -source 8 -target 8 -nowarn `
  -bootclasspath $androidJar -classpath $zxing -d (Join-Path $build 'classes') $sources
if ($LASTEXITCODE -ne 0) { throw 'javac 失败' }

Write-Host '[5/7] 转 dex(d8)'
$classes = (Get-ChildItem (Join-Path $build 'classes') -Recurse -Filter *.class | Select-Object -ExpandProperty FullName)
& "$btD8\d8.bat" --lib $androidJar --min-api 24 --release --output (Join-Path $build 'dex') $classes $zxing
if ($LASTEXITCODE -ne 0) { throw 'd8 失败' }

Write-Host '[6/7] 合成 APK + 对齐(zip / zipalign)'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$apk = Join-Path $build 'base.apk'
$zip = [System.IO.Compression.ZipFile]::Open($apk, 'Update')
$entry = $zip.CreateEntry('classes.dex', [System.IO.Compression.CompressionLevel]::Optimal)
$fs = $entry.Open()
$dexBytes = [System.IO.File]::ReadAllBytes((Join-Path $build 'dex\classes.dex'))
$fs.Write($dexBytes, 0, $dexBytes.Length)
$fs.Dispose()
# ⚠ 前端资源不能交给 `aapt2 link -A`:实测 Windows 下它把条目名写成
#   `assets/www\assets\xxx`(反斜杠),WebView 按 `file:///android_asset/www/index.html`
#   找不到 ⇒ 白屏。这里自己按 POSIX 分隔符塞进 zip,条目名一定是 `assets/www/...`。
$wwwFiles = Get-ChildItem $www -Recurse -File
foreach ($f in $wwwFiles) {
  $rel = $f.FullName.Substring($www.Length).TrimStart('\', '/').Replace('\', '/')
  $e = $zip.CreateEntry("assets/www/$rel", [System.IO.Compression.CompressionLevel]::Optimal)
  $s = $e.Open()
  $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
  $s.Write($bytes, 0, $bytes.Length)
  $s.Dispose()
}
Write-Host ("      已写入前端资源 {0} 个文件(assets/www/…)" -f $wwwFiles.Count)
$zip.Dispose()

& "$bt\zipalign.exe" -f 4 $apk (Join-Path $build 'aligned.apk')
if ($LASTEXITCODE -ne 0) { throw 'zipalign 失败' }

Write-Host '[7/7] 签名(apksigner + debug keystore)'
$ks = Join-Path $proj 'debug.keystore'
if (-not (Test-Path $ks)) {
  & "$javaHome\bin\keytool.exe" -genkeypair -v -keystore $ks -storepass android -keypass android `
    -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 `
    -dname "CN=Yinjia MES Debug,O=Yinjia,C=CN" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'keytool 生成 keystore 失败' }
}
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$out = Join-Path $dist ("yinjia-mes-{0}.apk" -f $version)
if (Test-Path $out) { Remove-Item $out -Force }
& "$bt\apksigner.bat" sign --ks $ks --ks-pass pass:android --key-pass pass:android `
  --out $out (Join-Path $build 'aligned.apk')
if ($LASTEXITCODE -ne 0) { throw 'apksigner 签名失败' }
& "$bt\apksigner.bat" verify --print-certs $out | Select-Object -First 3

$size = [Math]::Round((Get-Item $out).Length / 1KB, 1)
Write-Host ""
Write-Host ("APK : {0}  ({1} KB)" -f $out, $size)
Write-Host ("签名: debug.keystore(自签名,可直接侧载;上架需换正式签名)")

if ($Install) {
  $adb = Join-Path $sdk 'platform-tools\adb.exe'
  Write-Host '[安装] adb install -r'
  & $adb install -r $out
}
