# _verify-qc-tc-legacy.ps1 — 旧口径(检验直产)特采单仍可正常审批生单(2026-10-04 口径切换的向后兼容)
# 取测试账套里 TCI-2026-09-0009(来源 QC_INSP→QC_TC_IN,未审核、无入库单),走「审核」看是否照旧生成采购入库单。
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Base = 'http://127.0.0.1:8090'
$tcNo = 'TCI-2026-09-0009'
$fail = 0
function Ok($m)  { Write-Host "  [OK]   $m" -ForegroundColor Green }
function Bad($m) { Write-Host "  [FAIL] $m" -ForegroundColor Red; $script:fail++ }

function Api($method, $path, $body) {
  $cargs = @('-s', '-X', $method, "$Base$path", '-H', 'Content-Type: application/json')
  if ($script:token) { $cargs += @('-H', "Authorization: Bearer $($script:token)") }
  $tmp = $null
  if ($null -ne $body) {
    $tmp = Join-Path $env:TEMP 'yj-tc-legacy.json'
    [System.IO.File]::WriteAllText($tmp, ($body | ConvertTo-Json -Depth 12 -Compress), (New-Object System.Text.UTF8Encoding $false))
    $cargs += @('-d', "@$tmp")
  }
  $raw = & curl.exe @cargs
  if ($tmp) { Remove-Item $tmp -ErrorAction SilentlyContinue }
  if (-not $raw) { throw "API $path 空响应" }
  return ($raw | ConvertFrom-Json)
}
function SqlOne([string]$q) {
  $f = Join-Path $env:TEMP 'yj-tc-legacy-probe.sql'
  [System.IO.File]::WriteAllText($f, "SET NOCOUNT ON;`nGO`n$q`nGO`n", (New-Object System.Text.UTF8Encoding $false))
  $env:YINJIA_SQL_PASS = 'Yinjia@2026'
  Push-Location 'D:\YINJIA-main\tools'
  try {
    $rows = & java "-Dsun.stdout.encoding=UTF-8" -cp 'lib\mssql-jdbc.jar' SqlRunner.java `
        'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true' yinjia env $f 2>$null
  } finally { Pop-Location }
  foreach ($line in $rows) { if ($line -match '^\s*\|\s*(.*?)\s*\|\s*$') { return $Matches[1] } }
  return $null
}

$login = Api 'POST' '/api/auth/login' @{ userName = 'admin'; password = '123456'; factory = 'YJ_TEST' }
$script:token = $login.data.token
Ok '登录测试账套'

$before = SqlOne "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_TC_IN' AND source_form_no='$tcNo' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'"
Write-Host "  旧特采单 $tcNo 审核前 ACTIVE 入库链路 = $before"

# 特采单走两级审批(2026-10-04),没有「审核」这条直达路 —— 提交审批 → 一级通过 → 超级管理员批准
foreach ($btn in @('提交审批', '审批通过', '审批通过')) {
  $r = Api 'POST' '/api/px/callButton' @{ panelCode = 'QC_TC_IN'; buttonName = $btn; formData = @{ 编号 = $tcNo }; buttonParam = @{} }
  if ($r.code -ne 200) { Bad "$btn 失败: $($r.message)"; exit 1 }
  Ok "$btn 成功(状态:$($r.data.单据状态))"
}

$piNo = SqlOne "SELECT target_form_no FROM form_flow_link WHERE source_panel_code='QC_TC_IN' AND source_form_no='$tcNo' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'"
if ($piNo) { Ok "照旧生成采购入库单 $piNo" } else { Bad '旧口径特采单审核后没有生成采购入库单' }
if ($piNo) {
  $qty = SqlOne "SELECT 实收数量 FROM bl_purchase_in WHERE 单据编号='$piNo'"
  $tc  = SqlOne "SELECT 特采 FROM bl_purchase_in WHERE 单据编号='$piNo'"
  if ($qty -like '1*') { Ok "入库行实收数量=$qty(特采单总数量 1kg)" } else { Bad "入库行实收数量=$qty,应为 1" }
  if ($tc -eq '是') { Ok '入库行特采=是' } else { Bad "入库行特采=$tc,应为 是" }
}

Write-Host ''
if ($script:fail -eq 0) { Write-Host 'RESULT: PASS' -ForegroundColor Green; exit 0 }
Write-Host "RESULT: FAIL-$($script:fail)" -ForegroundColor Red; exit 1
