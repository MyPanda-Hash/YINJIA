param(
  [string]$Base = "http://36.140.66.163:8090",
  [string]$OutFile = "D:\YINJIA-main\_scratch\server-pin-all.json",
  [string]$Panel = "PURCHASE_IN",
  [int]$PageSize = 500
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
$enc = New-Object System.Text.UTF8Encoding($false)
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(120)

function Post-Json([string]$url, $obj, [string]$token) {
  $json = $obj | ConvertTo-Json -Depth 8 -Compress
  $content = New-Object System.Net.Http.StringContent($json, $enc, "application/json")
  if ($token) { $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $token) }
  $resp = $client.PostAsync($url, $content).Result
  $bytes = $resp.Content.ReadAsByteArrayAsync().Result
  $text = [System.Text.Encoding]::UTF8.GetString($bytes)
  if (-not $resp.IsSuccessStatusCode) { throw ("HTTP " + [int]$resp.StatusCode + " " + $text) }
  return $text | ConvertFrom-Json
}

$login = Post-Json "$Base/api/auth/login" @{ userName = "admin"; password = "123456" } $null
if ($login.code -ne 200) { throw ("LOGIN FAIL " + $login.code + " " + $login.message) }
$tok = $login.data.token

$q = @{ panelCode = $Panel; pageNo = 1; pageSize = $PageSize; condition = @{} }
$res = Post-Json "$Base/api/px/queryFormDataList" $q $tok
if ($res.code -ne 200) { throw ("QUERY FAIL " + $res.code + " " + $res.message) }
$rows = @($res.data.list)
$out = @()
foreach ($r in $rows) {
  $out += [pscustomobject]@{
    docNo   = [string]$r.'单据编号'
    date    = [string]$r.'单据日期'
    supplier = [string]$r.'供应商'
    poNo    = [string]$r.'采购订单号'
    batch   = [string]$r.'批次号'
    erpNo   = [string]$r.'ERP单号'
    erpFlag = [string]$r.'是否已转ERP'
    auditor = [string]$r.'审核人'
    auditAt = [string]$r.'审核时间'
    status  = [string]$r.'单据状态'
    src     = [string]$r.'来源'
    srcNo   = [string]$r.'来源单号'
    detailCount = if ($r.detail -and $r.detail.items) { @($r.detail.items).Count } else { 0 }
  }
}
[System.IO.File]::WriteAllText($OutFile, (ConvertTo-Json -InputObject $out -Depth 5), $enc)
Write-Output ("rows=" + $out.Count + " -> " + $OutFile)
