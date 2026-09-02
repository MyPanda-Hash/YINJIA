# audit-remote.ps1 — 生产服务器(36.140.66.163:8090)全量面板审计
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'
$base = 'http://36.140.66.163:8090'
$out = 'C:\INCER\YINJIA-MES\tools\_audit-remote-out.txt'

function ApiRaw($method, $path, $body, $token) {
  $cargs = @('-s', '-X', $method, "$base$path", '-H', 'Content-Type: application/json')
  if ($token) { $cargs += @('-H', "Authorization: Bearer $token") }
  $tmp = $null
  if ($body) {
    $json = $body | ConvertTo-Json -Depth 10 -Compress
    $tmp = Join-Path $env:TEMP 'yj-audit-remote.json'
    [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding $false))
    $cargs += @('-d', "@$tmp")
  }
  try { return (& curl.exe @cargs) } finally { if ($tmp) { Remove-Item $tmp -ErrorAction SilentlyContinue } }
}

$login = ApiRaw 'POST' '/api/auth/login' @{ userName = 'admin'; password = '123456' } $null | ConvertFrom-Json
if ($login.code -ne 200) { Write-Output "LOGIN FAIL: $($login.message)"; exit 1 }
$token = $login.data.token
Write-Output "login ok"

# 面板清单(远程库经 API:全部 panelCode 从 /api/sys/role/1/panels 拿?直接查远程 DB)
sqlcmd -S 36.140.66.163 -U yinjia -P 'Yinjia@2026' -d HSDZ_MES -Q "SET NOCOUNT ON; SELECT panel_code FROM yj_panel ORDER BY panel_code" -h -1 -W -u -o 'C:\INCER\YINJIA-MES\tools\_audit-remote-panels.txt' 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Output 'DB panel list failed (yinjia)'; exit 1 }
$panels = @(Get-Content 'C:\INCER\YINJIA-MES\tools\_audit-remote-panels.txt' -Encoding Unicode | ForEach-Object { $_.Trim() } | Where-Object { $_ })
Write-Output "panels: $($panels.Count)"

$failCfg = New-Object System.Collections.ArrayList
$failQry = New-Object System.Collections.ArrayList
$okCfg = 0; $okQry = 0

foreach ($p in $panels) {
  $raw = ApiRaw 'GET' "/api/px/getPanelConfig?panelCode=$p" $null $token
  try { $j = $raw | ConvertFrom-Json; if ($j.code -ne 200) { [void]$failCfg.Add("$p => code=$($j.code) $($j.message)") } else { $okCfg++ } } catch { [void]$failCfg.Add("$p => RAW: $raw") }
  $raw = ApiRaw 'POST' '/api/px/queryFormDataList' @{ panelCode = $p; pageNo = 1; pageSize = 1 } $token
  try { $j = $raw | ConvertFrom-Json; if ($j.code -ne 200) { [void]$failQry.Add("$p => code=$($j.code) $($j.message)") } else { $okQry++ } } catch { [void]$failQry.Add("$p => RAW: $raw") }
}

Write-Output "== 配置生成: ok=$okCfg fail=$($failCfg.Count) =="
foreach ($f in $failCfg) { Write-Output "  CFG-FAIL $f" }
Write-Output "== 数据查询: ok=$okQry fail=$($failQry.Count) =="
foreach ($f in $failQry) { Write-Output "  QRY-FAIL $f" }
Write-Output "== DONE =="
