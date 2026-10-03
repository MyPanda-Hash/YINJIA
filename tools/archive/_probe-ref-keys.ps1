# _probe-ref-keys.ps1 — 一次性探针:取参照面板 QC_RECV 的实际返回行键,
# 判定 refField 应写「单号」(label/dataName) 还是「单据编号」(物理列)。
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://127.0.0.1:8090'

$t = Join-Path $env:TEMP 'yj-l.json'
[System.IO.File]::WriteAllText($t, '{"userName":"admin","password":"123456"}', (New-Object System.Text.UTF8Encoding $false))
$token = (& curl.exe -s -X POST "$base/api/auth/login" -H 'Content-Type: application/json' -d "@$t" | ConvertFrom-Json).data.token
Remove-Item $t -ErrorAction SilentlyContinue

foreach ($p in @('QC_RECV', 'QC_INSP', 'PU_ORDER')) {
  $body = Join-Path $env:TEMP "yj-q-$p.json"
  [System.IO.File]::WriteAllText($body, "{""panelCode"":""$p"",""pageNo"":1,""pageSize"":2}", (New-Object System.Text.UTF8Encoding $false))
  $raw = & curl.exe -s -X POST "$base/api/px/queryFormDataList" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "@$body"
  Remove-Item $body -ErrorAction SilentlyContinue
  $j = $raw | ConvertFrom-Json
  $rows = @($j.data.list)
  Write-Output "===== $p  total=$($j.data.totalSize) rows=$($rows.Count) ====="
  if ($rows.Count -gt 0) {
    $keys = $rows[0].PSObject.Properties.Name
    Write-Output ("顶层键: " + ($keys -join ' | '))
    if ($rows[0].detail) {
      $dt = $rows[0].detail.PSObject.Properties
      foreach ($d in $dt) {
        Write-Output ("  detail.$($d.Name) 行数=" + @($d.Value).Count)
        if (@($d.Value).Count -gt 0) { Write-Output ("    行键: " + (@($d.Value)[0].PSObject.Properties.Name -join ' | ')) }
      }
    }
  }
}
