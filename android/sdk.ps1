# sdk.ps1 — 定位本机 Android SDK(2026-11-06)
#
# 被 build.ps1 / install.ps1 共用:以前两处各写一遍
#   `$env:ANDROID_HOME → ANDROID_SDK_ROOT → %LOCALAPPDATA%\Android\Sdk`
# 本机 SDK 实际装在 E:\SDK(既没设环境变量也不在默认位置)⇒ 两个脚本都直接抛
# 「找不到 Android SDK」,只能每次手动传 ANDROID_HOME。抽成一个函数,顺便补上
# 「各盘根目录常见安装名」这一层探测(不写死盘符,换机器/换盘也能用)。
#
# 用法:  . "$PSScriptRoot\sdk.ps1";  $sdk = Get-AndroidSdk
function Get-AndroidSdk {
  if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) { return $env:ANDROID_HOME }
  if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) { return $env:ANDROID_SDK_ROOT }

  $cands = @((Join-Path $env:LOCALAPPDATA 'Android\Sdk'))
  foreach ($drv in (Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root -match '^[A-Za-z]:\\$' })) {
    foreach ($sub in @('SDK', 'sdk', 'Android\Sdk', 'Android\android-sdk', 'android-sdk', 'android-sdk-windows')) {
      $cands += (Join-Path $drv.Root $sub)
    }
  }
  # 判据:同时有 build-tools 与 platforms 才算 SDK(platform-tools 可能单独安装)
  return $cands | Where-Object { (Test-Path (Join-Path $_ 'build-tools')) -and (Test-Path (Join-Path $_ 'platforms')) } |
    Select-Object -First 1
}
