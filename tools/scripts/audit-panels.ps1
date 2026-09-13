# audit-panels.ps1 — 全量面板审计:配置生成 + 数据查询(暴露视图/列缺失)+ 元数据静态校验
# 用法:& tools\audit-panels.ps1 [输出文件]
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:8090'
$out = if ($args[0]) { $args[0] } else { 'C:\INCER\YINJIA-MES\tools\_audit-out.txt' }

function ApiRaw($method, $path, $body, $token) {
  $cargs = @('-s', '-X', $method, "$base$path", '-H', 'Content-Type: application/json')
  if ($token) { $cargs += @('-H', "Authorization: Bearer $token") }
  $tmp = $null
  if ($body) {
    $json = $body | ConvertTo-Json -Depth 10 -Compress
    $tmp = Join-Path $env:TEMP 'yj-audit-body.json'
    [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding $false))
    $cargs += @('-d', "@$tmp")
  }
  try { return (& curl.exe @cargs) } finally { if ($tmp) { Remove-Item $tmp -ErrorAction SilentlyContinue } }
}

# ---- 登录 ----
$login = ApiRaw 'POST' '/api/auth/login' @{ userName = 'admin'; password = '123456' } $null | ConvertFrom-Json
if ($login.code -ne 200) { Write-Output "LOGIN FAIL: $($login.message)"; exit 1 }
$token = $login.data.token
Write-Output "login ok"

# ---- 面板清单 ----
$q = "SET NOCOUNT ON; SELECT panel_code FROM yj_panel ORDER BY panel_code;"
[System.IO.File]::WriteAllText('C:\INCER\YINJIA-MES\tools\_audit-panels-q.sql', $q, (New-Object System.Text.UTF8Encoding $false))
sqlcmd -S localhost -E -d HSDZ_MES -i 'C:\INCER\YINJIA-MES\tools\_audit-panels-q.sql' -h -1 -W -u -o 'C:\INCER\YINJIA-MES\tools\_audit-panels.txt' | Out-Null
$panels = @(Get-Content 'C:\INCER\YINJIA-MES\tools\_audit-panels.txt' -Encoding Unicode | ForEach-Object { $_.Trim() } | Where-Object { $_ })
Write-Output "panels: $($panels.Count)"

$failCfg = New-Object System.Collections.ArrayList
$failQry = New-Object System.Collections.ArrayList
$okCfg = 0; $okQry = 0

foreach ($p in $panels) {
  # 1) 面板配置生成
  $raw = ApiRaw 'GET' "/api/px/getPanelConfig?panelCode=$p" $null $token
  try {
    $j = $raw | ConvertFrom-Json
    if ($j.code -ne 200) { [void]$failCfg.Add("$p => code=$($j.code) $($j.message)") } else { $okCfg++ }
  } catch { [void]$failCfg.Add("$p => RAW: $raw") }
  # 2) 数据查询
  $raw = ApiRaw 'POST' '/api/px/queryFormDataList' @{ panelCode = $p; pageNo = 1; pageSize = 1 } $token
  try {
    $j = $raw | ConvertFrom-Json
    if ($j.code -ne 200) { [void]$failQry.Add("$p => code=$($j.code) $($j.message)") } else { $okQry++ }
  } catch { [void]$failQry.Add("$p => RAW: $raw") }
}

Write-Output "== 配置生成: ok=$okCfg fail=$($failCfg.Count) =="
foreach ($f in $failCfg) { Write-Output "  CFG-FAIL $f" }
Write-Output "== 数据查询: ok=$okQry fail=$($failQry.Count) =="
foreach ($f in $failQry) { Write-Output "  QRY-FAIL $f" }

# ---- DB 静态校验:表/视图存在性 + 字段列存在性 ----
$sql = @"
SET NOCOUNT ON;
-- 1) line_table/head_table 指向的对象不存在
SELECT 'MISSING_TABLE' AS kind, p.panel_code, p.line_table AS tbl FROM yj_panel p
WHERE p.line_table IS NOT NULL AND OBJECT_ID(p.line_table) IS NULL
UNION ALL
SELECT 'MISSING_TABLE', p.panel_code, p.head_table FROM yj_panel p
WHERE p.head_table IS NOT NULL AND OBJECT_ID(p.head_table) IS NULL;
-- 2) 真实表(line_table 为 U 表)上字段引用的列不存在
SELECT 'MISSING_COL' AS kind, f.panel_code, p.line_table AS tbl, f.label, f.col_name FROM yj_field f
JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE p.line_table IS NOT NULL AND OBJECT_ID(p.line_table, 'U') IS NOT NULL
  AND f.col_name IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(p.line_table) AND c.name = f.col_name);
"@
[System.IO.File]::WriteAllText('C:\INCER\YINJIA-MES\tools\_audit-db.sql', $sql, (New-Object System.Text.UTF8Encoding $false))
sqlcmd -S localhost -E -d HSDZ_MES -i 'C:\INCER\YINJIA-MES\tools\_audit-db.sql' -h -1 -W -u -o 'C:\INCER\YINJIA-MES\tools\_audit-db.txt' | Out-Null
$dbLines = @(Get-Content 'C:\INCER\YINJIA-MES\tools\_audit-db.txt' -Encoding Unicode | Where-Object { $_ -and $_.Trim() })
Write-Output "== DB 静态校验($($dbLines.Count) 条问题)=="
foreach ($l in $dbLines) { Write-Output "  DB $l" }

Write-Output "== DONE =="
