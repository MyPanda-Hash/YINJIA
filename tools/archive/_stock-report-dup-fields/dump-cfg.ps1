# dump-cfg.ps1 — 取库存报表组四张面板的网格列(取证:修复前/后各跑一次)
# 用法: powershell -File dump-cfg.ps1 <输出文件后缀>
param([string]$tag = 'before')
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8090'
$dir = 'D:\YINJIA-main\tools\archive\_stock-report-dup-fields'
$body = '{"userName":"admin","password":"123456"}'
$tmp = Join-Path $env:TEMP 'yj-login.json'
[System.IO.File]::WriteAllText($tmp, $body, (New-Object System.Text.UTF8Encoding $false))
$login = (curl.exe -s -X POST "$base/api/auth/login" -H 'Content-Type: application/json' -d "@$tmp") | ConvertFrom-Json
$token = $login.data.token
$lines = @()
foreach ($p in @('STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_SUMMARY', 'STOCK_DETAIL')) {
  $out = Join-Path $env:TEMP "cfg-$p.json"
  curl.exe -s "$base/api/px/getPanelConfig?panelCode=$p" -H "Authorization: Bearer $token" -o $out
  $cfg = Get-Content $out -Raw -Encoding utf8 | ConvertFrom-Json
  $tp = $cfg.data.metadata.panelPageDto.tablePages[0]
  $cols = @($tp.gridTabs[0].columns)
  $dup = $cols | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { "$($_.Name)x$($_.Count)" }
  $lines += "$p`t$($cfg.data.metadata.panelName)`t列数=$($cols.Count)`t重复=[$($dup -join ',')]`tORDER=`t$($cols -join ' | ')"
}
$dst = Join-Path $dir "cfg-$tag.txt"
$lines | Set-Content -Encoding utf8 $dst
$lines
