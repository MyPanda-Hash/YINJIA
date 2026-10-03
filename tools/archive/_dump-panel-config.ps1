# _dump-panel-config.ps1 — 一次性探针:登录后取四单运行时面板配置(字段与显示顺序的真源)
# 用法: powershell -ExecutionPolicy Bypass -File tools\archive\_dump-panel-config.ps1
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://127.0.0.1:8090'
$outDir = Join-Path $PSScriptRoot '_dump-out'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$loginTmp = Join-Path $env:TEMP 'yj-login.json'
[System.IO.File]::WriteAllText($loginTmp, '{"userName":"admin","password":"123456"}', (New-Object System.Text.UTF8Encoding $false))
$loginRaw = & curl.exe -s -X POST "$base/api/auth/login" -H 'Content-Type: application/json' -d "@$loginTmp"
Remove-Item $loginTmp -ErrorAction SilentlyContinue
$login = $loginRaw | ConvertFrom-Json
if ($login.code -ne 200) { throw "登录失败: $loginRaw" }
$token = $login.data.token
Write-Output "登录 OK, token 长度 $($token.Length)"

foreach ($p in @('QC_RECV', 'QC_INSP', 'QC_RETURN', 'PURCHASE_IN')) {
  $raw = & curl.exe -s -H "Authorization: Bearer $token" "$base/api/px/getPanelConfig?panelCode=$p"
  $f = Join-Path $outDir "$p.runtime.json"
  [System.IO.File]::WriteAllText($f, $raw, (New-Object System.Text.UTF8Encoding $false))
  $j = $raw | ConvertFrom-Json
  $m = $j.data.metadata
  $tp = $m.panelPageDto.tablePages[0]
  $fp = @($m.panelPageDto.formPages)[0]
  Write-Output ("{0} | {1} | form={2} query={3} gridCols={4} detailTabs={5} bytes={6}" -f `
      $p, $m.panelName, @($fp.fields).Count, @($tp.queryFields).Count, @($tp.gridTabs[0].columns).Count, @($j.data.detail.tabs).Count, $raw.Length)
}
Write-Output "输出目录: $outDir"
