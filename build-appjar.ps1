<#
  YINJIA-MES 一键打包 -> app.jar(服务器内测部署产物)
  ==================================================
  流程: 前端 npm run build -> dist 镜像同步到后端内嵌 static(/MIR 清陈旧产物)
        -> Maven 打包 -> 复制为 backend\target\app.jar

  用法:  powershell -ExecutionPolicy Bypass -File build-appjar.ps1
         powershell -ExecutionPolicy Bypass -File build-appjar.ps1 -SkipFrontend   # 前端未改时跳过

  部署:  上传 app.jar 覆盖服务器同名文件,重启进程即可(首次部署见 docs\deploy\服务器部署.md)
#>
[CmdletBinding()]
param(
  [switch]$SkipFrontend
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# ---------- 1/4 前端构建 ----------
if (-not $SkipFrontend) {
  Write-Host '[1/4] 前端 npm run build ...'
  Push-Location "$root\frontend"
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "前端构建失败(exit=$LASTEXITCODE)" }
  } finally { Pop-Location }
  Write-Host '[1/4] 前端构建 OK'
} else {
  Write-Host '[1/4] 跳过前端构建(-SkipFrontend)'
}

# ---------- 2/4 dist -> 后端内嵌 static(镜像同步) ----------
$dist   = "$root\frontend\dist"
$static = "$root\backend\src\main\resources\static"
if (-not (Test-Path "$dist\index.html")) { throw "dist 缺少 index.html,请先构建前端" }
Write-Host '[2/4] 同步 dist 到后端 static(镜像)...'
robocopy $dist $static /MIR /NFL /NDL /NJH /NJS /R:1 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy 同步失败(exit=$LASTEXITCODE)" }
Write-Host '[2/4] static 同步 OK'

# ---------- 3/4 Maven 打包 ----------
$env:YINJIA_M2_REPO = "$root\.m2-repo"
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
  foreach ($cand in @('D:\Program Files\Java\jdk-24', 'C:\Program Files\Java\jdk-17')) {
    if (Test-Path "$cand\bin\java.exe") { $env:JAVA_HOME = $cand; break }
  }
}
$mvn = "$root\tools\apache-maven-3.9.9\bin\mvn.cmd"
if (-not (Test-Path $mvn)) { throw "未找到 Maven: $mvn(应位于 tools\apache-maven-3.9.9)" }
Write-Host '[3/4] Maven package ...'
& $mvn -q -s "$root\tools\settings.xml" -f "$root\backend\pom.xml" -DskipTests package
if ($LASTEXITCODE -ne 0) { throw "mvn package 失败(exit=$LASTEXITCODE)" }
Write-Host '[3/4] 后端打包 OK'

# ---------- 4/4 产出 app.jar ----------
$src = "$root\backend\target\yinjia-mes-backend-0.1.0.jar"
$out = "$root\backend\target\app.jar"
if (-not (Test-Path $src)) { throw "未找到打包产物: $src" }
Copy-Item $src $out -Force
$h  = (Get-FileHash $out -Algorithm SHA256).Hash
$mb = [math]::Round((Get-Item $out).Length / 1MB, 1)

Write-Host '[4/4] 产出 app.jar OK'
Write-Host ''
Write-Host "部署产物 : $out  ($mb MB)"
Write-Host "SHA256   : $h"
Write-Host ''
Write-Host '更新流程 : 停服务 -> 覆盖服务器 app.jar -> 启动(数据库/JWT 配置见 application.yml 环境变量)'
