# 库位→仓位 改名 端到端验证(8089/8090 实跑;2026-10-08)
# 验证点:① 面板名=仓位 ② qrLabelKey=仓位编码 ③ 网格列出现 仓位编码/仓位地址(无 库位*)
#         ④ 档案查询能返回行且行内含 仓位编码/仓位地址 键(证明物理列改名后引擎取数正常)
#         ⑤ 打印用数据键齐全(仓库/仓库编码/仓位地址/仓位编码)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://localhost:8090'

function Api($method, $path, $body, $token) {
  $cargs = @('-s', '-X', $method, "$base$path", '-H', 'Content-Type: application/json')
  if ($token) { $cargs += @('-H', "Authorization: Bearer $token") }
  $tmp = $null
  if ($body) {
    # ⚠ PS5.1:JSON 直接进命令行会被引号吞掉(同 tools/scripts/verify-api.ps1 的坑),一律走临时文件
    $json = $body | ConvertTo-Json -Depth 10 -Compress
    $tmp = Join-Path $env:TEMP 'yj-whloc-body.json'
    [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding $false))
    $cargs += @('-d', "@$tmp")
  }
  try { $raw = & curl.exe @cargs } finally { if ($tmp) { Remove-Item $tmp -ErrorAction SilentlyContinue } }
  $parsed = $raw | ConvertFrom-Json
  if ($parsed.code -and $parsed.code -ne 200) { throw "API $path 失败: code=$($parsed.code) $($parsed.message)" }
  return $parsed
}

$login = Api 'POST' '/api/auth/login' @{ userName = 'admin'; password = '123456' } $null
$token = $login.data.token
Write-Output "登录 OK"

Write-Output ''
Write-Output '== 1. WHLOC 面板配置 =='
$cfg = Api 'GET' '/api/px/getPanelConfig?panelCode=WHLOC' $null $token
$m = $cfg.data.metadata
Write-Output ("面板码      : {0}" -f $m.panelCode)
Write-Output ("面板名      : {0}   (期望 仓位)" -f $m.panelName)
Write-Output ("qrLabelKey  : {0}   (期望 仓位编码)" -f $m.qrLabelKey)
Write-Output ("qrLabelScope: {0}" -f $m.qrLabelScopeKey)
Write-Output ("qrLabelKind : {0}" -f $m.qrLabelKind)
$cols = $m.panelPageDto.tablePages[0].gridTabs[0].columns
Write-Output ("网格列      : {0}" -f (($cols | ForEach-Object { $_.dataName }) -join ' / '))
$qcols = $m.panelPageDto.tablePages[0].queryFields
Write-Output ("查询字段    : {0}" -f (($qcols | ForEach-Object { $_.dataName }) -join ' / '))

Write-Output ''
Write-Output '== 2. 档案查询(物理列改名后引擎能否取数) =='
$q = Api 'POST' '/api/px/queryFormDataList' @{ panelCode = 'WHLOC'; pageNo = 1; pageSize = 100 } $token
Write-Output ("totalSize   : {0}" -f $q.data.totalSize)
$items = $q.data.list[0].detail.locations
Write-Output ("明细行数    : {0}" -f $items.Count)
if ($items.Count -gt 0) {
  $r = $items[0]
  $keys = ($r.PSObject.Properties.Name) -join ' / '
  Write-Output ("第1行键     : {0}" -f $keys)
  foreach ($k in @('仓库', '仓库编码', '仓位编码', '仓位地址')) {
    Write-Output ("  {0,-8} = {1}" -f $k, $r.$k)
  }
  $bad = $items | Where-Object { $_.PSObject.Properties.Name -contains '库位编码' -or $_.PSObject.Properties.Name -contains '库位地址' }
  Write-Output ("残留库位键行数: {0}  (期望 0)" -f @($bad).Count)
}

Write-Output ''
Write-Output '== 3. WH 仓库面板的 仓位 字段 =='
$cfg2 = Api 'GET' '/api/px/getPanelConfig?panelCode=WH' $null $token
$cols2 = $cfg2.data.metadata.panelPageDto.tablePages[0].gridTabs[0].columns
Write-Output ("WH 网格列   : {0}" -f (($cols2 | ForEach-Object { $_.dataName }) -join ' / '))
