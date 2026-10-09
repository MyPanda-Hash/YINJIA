# _fatjar-inplace.ps1 — 目标 jar 被占用(改名/删除被拒,写入仍可)时的打包绕行(一次性工具,2026-10-06)
#
# 背景:backend\target\yinjia-mes-backend-0.1.0.jar 被某个进程持有句柄(Restart Manager 查不到、
#   java/node 进程列表里也没有,疑似系统级/杀软句柄)。spring-boot:repackage 必须先把旧 jar 改名成
#   .jar.original 才能写 fat jar ⇒ 改名失败 ⇒ BUILD FAILURE,磁盘上只剩**瘦 jar**(无 BOOT-INF/lib),
#   此时重启服务必起不来(build-appjar.ps1 头部注释里记的同一个坑)。
#
# 做法:骨架(MANIFEST/BOOT-INF/lib/索引/加载器)从同 pom 构建出来的既有 fat jar(app.jar)里取,
#   classes 用本次 mvn compile 的产物,在**未被占用的新路径**上重新打一个 fat jar,
#   再按字节**原始写回**目标路径(CREATE_ALWAYS 截断写 —— jar 插件本身就是这么把瘦 jar 写进去的)。
#
# fat jar 的三条硬约束(三个坑都实测踩过,别再走):
#   ① 加载器类 org/springframework/boot/loader/** 在 jar **根**上(不在 BOOT-INF 下)——
#      漏了 ⇒ 启动即 ClassNotFoundException: org.springframework.boot.loader.launch.JarLauncher。
#   ② **嵌套依赖 jar 必须不压缩(STORED)**——jar 工具默认 DEFLATE ⇒ 依赖都在、却
#      ClassNotFoundException: org.springframework.security.crypto.password.PasswordEncoder。
#      故本脚本用 `jar cf0m`(0 = 全部 STORED)。
#   ③ **目录条目必须保留**(BOOT-INF/classes/com/yinjia/mes/service/ 这类)——用 ZipArchive 原地
#      增删条目重打时会把目录条目一并删掉,类扫描随即找不到任何 @Service:
#      "Parameter 0 of method invCostReconciler ... required a bean of type 'InvCostService'"。
#      `jar` 工具会自动补目录条目,故走它。
#
# 前置:mvn compile 已跑过(backend\target\classes 是最新产物);app.jar 与当前 pom 依赖集一致
#   (核对:`git log --since=<app.jar 日期> -- backend/pom.xml` 为空)。
#
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File tools\archive\_fatjar-inplace.ps1
param(
    [string]$Base = 'backend\target\app.jar',
    [string]$Target = 'backend\target\yinjia-mes-backend-0.1.0.jar',
    [string]$Classes = 'backend\target\classes',
    [string]$Stage = 'backend\target\_fatstage'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = Split-Path $PSScriptRoot -Parent | Split-Path -Parent
Set-Location $root

$jarExe = Join-Path 'C:\Users\vigna\.jdks\ms-25.0.4' 'bin\jar.exe'
if (-not (Test-Path $jarExe)) { throw "未找到 jar.exe: $jarExe(按需改成机器上的 JDK 25 路径)" }
$basePath = (Resolve-Path $Base).Path
$tgtPath = Join-Path $root $Target
$clsPath = (Resolve-Path $Classes).Path
$stageAbs = Join-Path $root $Stage
$work = Join-Path $root 'backend\target\_fatwork.jar'

# ---------- 1/4 骨架:MANIFEST + 索引 + 嵌套依赖 + 根上的加载器类 ----------
if (Test-Path $stageAbs) { Remove-Item $stageAbs -Recurse -Force }
New-Item -ItemType Directory $stageAbs | Out-Null
Push-Location $stageAbs
& $jarExe xf $basePath 'META-INF/MANIFEST.MF' 'BOOT-INF/classpath.idx' 'BOOT-INF/layers.idx' 'BOOT-INF/lib' 'org/springframework/boot/loader'
if ($LASTEXITCODE -ne 0) { Pop-Location; throw '解骨架失败' }
Pop-Location
foreach ($need in @('META-INF\MANIFEST.MF', 'BOOT-INF\lib', 'org\springframework\boot\loader\launch\JarLauncher.class')) {
    if (-not (Test-Path (Join-Path $stageAbs $need))) { throw "骨架缺少 $need" }
}
$libs = @(Get-ChildItem (Join-Path $stageAbs 'BOOT-INF\lib') -Filter *.jar)
if ($libs.Count -lt 50) { throw "骨架 lib 异常($($libs.Count))" }

# ---------- 2/4 本次编译产物 -> BOOT-INF/classes(整棵子树替换,天然无陈旧条目) ----------
$dstClasses = Join-Path $stageAbs 'BOOT-INF\classes'
New-Item -ItemType Directory $dstClasses -Force | Out-Null
Copy-Item (Join-Path $clsPath '*') $dstClasses -Recurse -Force
$clsCount = @(Get-ChildItem $dstClasses -Recurse -File).Count
Write-Host "骨架 lib = $($libs.Count);本次 classes 文件 = $clsCount"
if ($clsCount -lt 100) { throw "classes 产物异常($clsCount)" }

# ---------- 3/4 打新 fat jar(新路径;0 = 嵌套依赖不压缩) ----------
if (Test-Path $work) { Remove-Item $work -Force }
& $jarExe cf0m $work (Join-Path $stageAbs 'META-INF\MANIFEST.MF') -C $stageAbs .
if ($LASTEXITCODE -ne 0) { throw '打 fat jar 失败' }

# ---------- 4/4 写回目标路径(截断写,容忍他方持有句柄) ----------
$in = [IO.File]::OpenRead($work)
try {
    $out = [IO.File]::Open($tgtPath, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::ReadWrite)
    try { $in.CopyTo($out) } finally { $out.Dispose() }
} finally { $in.Dispose() }

$mb = [math]::Round((Get-Item $tgtPath).Length / 1MB, 1)
$a = (Get-FileHash $work -Algorithm SHA256).Hash
$b = (Get-FileHash $tgtPath -Algorithm SHA256).Hash
Write-Host "写回完成: $tgtPath ($mb MB)"
if ($a -ne $b) { throw '写回校验不一致' }
Write-Host "SHA256 = $a"

# ---------- 自检:嵌套依赖 STORED + 目录条目在 + 加载器/主类/清单齐 ----------
$z = [IO.Compression.ZipFile]::OpenRead($tgtPath)
try {
    $lib = @($z.Entries | Where-Object { $_.FullName -like 'BOOT-INF/lib/*.jar' })
    $stored = @($lib | Where-Object { $_.CompressedLength -eq $_.Length }).Count
    $dirs = @($z.Entries | Where-Object { $_.FullName -like 'BOOT-INF/classes/*' -and $_.FullName.EndsWith('/') })
    $loader = @($z.Entries | Where-Object { $_.FullName -eq 'org/springframework/boot/loader/launch/JarLauncher.class' }).Count
    $appCls = @($z.Entries | Where-Object { $_.FullName -eq 'BOOT-INF/classes/com/yinjia/mes/MesApplication.class' }).Count
    $svcDir = @($z.Entries | Where-Object { $_.FullName -eq 'BOOT-INF/classes/com/yinjia/mes/service/' }).Count
    $mf = @($z.Entries | Where-Object { $_.FullName -eq 'META-INF/MANIFEST.MF' }).Count
    Write-Host "自检: lib=$($lib.Count)(STORED $stored) 类目录条目=$($dirs.Count) service目录=$svcDir JarLauncher=$loader MesApplication=$appCls MANIFEST=$mf"
    if ($lib.Count -lt 50) { throw '自检失败:lib 数不足' }
    if ($stored -ne $lib.Count) { throw '自检失败:嵌套依赖未全部 STORED' }
    if ($dirs.Count -lt 5 -or $svcDir -ne 1) { throw '自检失败:类目录条目缺失(会导致 @Service 扫不到)' }
    if ($loader -ne 1 -or $appCls -ne 1 -or $mf -ne 1) { throw '自检失败:加载器/主类/清单不符' }
} finally { $z.Dispose() }
Write-Host 'OK'
