param(
  [string]$Base = "http://36.140.66.163:8090",
  [string]$OutDir = "D:\YINJIA-main\_scratch"
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
$enc = New-Object System.Text.UTF8Encoding($false)
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(180)

function Post-Json([string]$url, $obj, [string]$token) {
  $json = $obj | ConvertTo-Json -Depth 8 -Compress
  $content = New-Object System.Net.Http.StringContent($json, $enc, "application/json")
  if ($token) { $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $token) }
  $resp = $client.PostAsync($url, $content).Result
  $text = [System.Text.Encoding]::UTF8.GetString($resp.Content.ReadAsByteArrayAsync().Result)
  if (-not $resp.IsSuccessStatusCode) { throw ("HTTP " + [int]$resp.StatusCode + " " + $text) }
  return $text | ConvertFrom-Json
}

$login = Post-Json "$Base/api/auth/login" @{ userName = "admin"; password = "123456" } $null
if ($login.code -ne 200) { throw ("LOGIN FAIL") }
$tok = $login.data.token

# 1) 采购入库单全量(含明细)
$pin = Post-Json "$Base/api/px/queryFormDataList" @{ panelCode = "PURCHASE_IN"; pageNo = 1; pageSize = 500; condition = @{} } $tok
$pinRows = @($pin.data.list)
[System.IO.File]::WriteAllText((Join-Path $OutDir "server-pin-full.json"), (ConvertTo-Json -InputObject $pinRows -Depth 12), $enc)
Write-Output ("PIN rows=" + $pinRows.Count)

# 2) 需要定位的采购订单号
$need = @{}
foreach ($r in $pinRows) {
  $erpFlag = [string]$r.'是否已转ERP'
  if ($erpFlag -ne '是' -and [string]$r.'单据状态' -eq '已审核') {
    $po = [string]$r.'采购订单号'
    if ($po) {
      foreach ($p in ($po -split '[、,]')) {
        $p = $p.Trim(); if ($p) { $need[$p] = 1 }
      }
    }
  }
}
Write-Output ("need POs=" + $need.Count + " : " + (($need.Keys | Sort-Object) -join ','))

# 3) 采购订单分页扫,命中即收
$found = @()
$page = 1
$size = 300
while ($page -le 15) {
  $pu = Post-Json "$Base/api/px/queryFormDataList" @{ panelCode = "PU_ORDER"; pageNo = $page; pageSize = $size; condition = @{} } $tok
  $list = @($pu.data.list)
  Write-Output ("PU page " + $page + " rows=" + $list.Count)
  if ($list.Count -eq 0) { break }
  foreach ($r in $list) {
    $no = [string]$r.'单据编号'
    if ($need.ContainsKey($no)) { $found += $r }
  }
  if ($found.Count -ge $need.Count) { break }
  if ($list.Count -lt $size) { break }
  $page++
}
[System.IO.File]::WriteAllText((Join-Path $OutDir "server-po-full.json"), (ConvertTo-Json -InputObject $found -Depth 12), $enc)
Write-Output ("PU matched=" + $found.Count + " : " + (($found | ForEach-Object { [string]$_.'单据编号' }) -join ','))
