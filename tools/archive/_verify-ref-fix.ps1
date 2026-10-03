# _verify-ref-fix.ps1 — 一次性验收:四单 API 通 + 参照源已回正(可与基线文档 §5 对照)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://127.0.0.1:8090'

$t = Join-Path $env:TEMP 'yj-v.json'
[System.IO.File]::WriteAllText($t, '{"userName":"admin","password":"123456"}', (New-Object System.Text.UTF8Encoding $false))
$token = (& curl.exe -s -X POST "$base/api/auth/login" -H 'Content-Type: application/json' -d "@$t" | ConvertFrom-Json).data.token
Remove-Item $t -ErrorAction SilentlyContinue
Write-Output "1) 登录 OK"

Write-Output '2) 四单面板配置 + 列表查询'
foreach ($p in @('QC_RECV', 'QC_INSP', 'QC_RETURN', 'PURCHASE_IN')) {
  $cfg = (& curl.exe -s -H "Authorization: Bearer $token" "$base/api/px/getPanelConfig?panelCode=$p" | ConvertFrom-Json)
  $b = Join-Path $env:TEMP "yj-v-$p.json"
  [System.IO.File]::WriteAllText($b, "{""panelCode"":""$p"",""pageNo"":1,""pageSize"":1}", (New-Object System.Text.UTF8Encoding $false))
  $q = (& curl.exe -s -X POST "$base/api/px/queryFormDataList" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "@$b" | ConvertFrom-Json)
  Remove-Item $b -ErrorAction SilentlyContinue
  Write-Output ("   {0,-12} {1,-8} 单据 {2} 张" -f $p, $cfg.data.metadata.panelName, $q.data.totalSize)
}

Write-Output '3) 参照源抽查(应弹对应档案,不该全是供应商)'
$checks = @(
  @{ p = 'QC_RECV'; n = '物料编码'; want = 'INV' },
  @{ p = 'QC_RECV'; n = '业务员'; want = 'EMP' },
  @{ p = 'QC_RECV'; n = '仓库'; want = 'WH' },
  @{ p = 'QC_INSP'; n = '暂收单号'; want = 'QC_RECV' },
  @{ p = 'QC_INSP'; n = '检验方案'; want = 'QC_PLAN' },
  @{ p = 'QC_INSP'; n = '单位'; want = 'UOM' }
)
$pass = 0
foreach ($c in $checks) {
  $cfg = (& curl.exe -s -H "Authorization: Bearer $token" "$base/api/px/getPanelConfig?panelCode=$($c.p)" | ConvertFrom-Json)
  $all = @($cfg.data.dataSchema.fields) + @($cfg.data.metadata.panelPageDto.tablePages[0].queryFields) + @($cfg.data.detail.tabs[0].fields)
  $f = $all | Where-Object { $_.dataName -eq $c.n -and $_.refPanel } | Select-Object -First 1
  $ok = $f -and $f.refPanel -eq $c.want
  if ($ok) { $pass++ }
  Write-Output ("   {0} {1,-12} {2,-8} -> {3}.{4}" -f $(if ($ok) { '[PASS]' } else { '[FAIL]' }), $c.p, $c.n, $f.refPanel, $f.refField)
}
Write-Output "   结果 $pass/$($checks.Count)"
