# install.ps1 — 等手机连上后再安装 APK(2026-10-20)
#
# 场景:先出包,手机晚点插;插上后一条命令装好,不用再跑整条构建。
# 用法(仓库根):
#   powershell -ExecutionPolicy Bypass -File android\install.ps1              # 等设备 -> 安装
#   powershell -ExecutionPolicy Bypass -File android\install.ps1 -Timeout 300 # 最多等 5 分钟
param([int]$Timeout = 180)

$ErrorActionPreference = 'Stop'
$here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$adb = Join-Path $sdk 'platform-tools\adb.exe'
if (-not (Test-Path $adb)) { throw "找不到 adb:$adb" }

$apk = Get-ChildItem (Join-Path $here 'dist\*.apk') -ErrorAction SilentlyContinue |
       Where-Object { $_.Name -notlike '*.idsig' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $apk) { throw 'dist\ 下没有 APK,先跑 android\build.ps1' }
Write-Host ("APK: {0} ({1} KB)" -f $apk.FullName, [Math]::Round($apk.Length / 1KB, 1))

Write-Host "[1/2] 等待手机连接(USB 调试已打开;最多 $Timeout 秒)"
$waited = 0
while ($waited -lt $Timeout) {
  $lines = & $adb devices
  $dev = $lines | Select-String -Pattern "^\s*(\S+)\s+device$"
  if ($dev) { Write-Host ("      已连接:{0}" -f $dev.Matches[0].Groups[1].Value); break }
  Start-Sleep -Seconds 3; $waited += 3
  if ($waited % 15 -eq 0) { Write-Host ("      仍在等待… {0}s" -f $waited) }
}
$lines = & $adb devices
if (-not ($lines | Select-String -Pattern "^\s*(\S+)\s+device$")) {
  Write-Host '没有等到设备。可能原因:USB 线只是充电线 / 没开「USB 调试」/ 手机上没点「允许调试」。'
  & $adb devices
  exit 1
}

Write-Host '[2/2] 安装(-r 覆盖安装,保留数据)'
& $adb install -r $apk.FullName
if ($LASTEXITCODE -ne 0) { throw '安装失败(见上面 adb 输出)' }

Write-Host ''
Write-Host '装好了。首次打开请在「接口地址」里填你的 MES 服务器,例如 http://192.168.1.10:8090'
