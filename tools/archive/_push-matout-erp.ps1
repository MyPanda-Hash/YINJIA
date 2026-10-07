# _push-matout-erp.ps1 — 对指定账套/实例执行材料出库单「转ERP」(单张单据)
# 用法: powershell -File tools\archive\_push-matout-erp.ps1 -Base http://127.0.0.1:8091 -DocNo CL-2026-10-0001
param(
  [string]$Base = 'http://127.0.0.1:8091',
  [string]$DocNo = '',
  [string]$Factory = 'YJ_TEST'
)
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Call([hashtable]$body, [string]$token) {
  $tmp = Join-Path $env:TEMP 'yj-matout-push-body.json'
  [System.IO.File]::WriteAllText($tmp, ($body | ConvertTo-Json -Depth 12 -Compress), (New-Object System.Text.UTF8Encoding $false))
  $r = & curl.exe -s -X POST "$Base/api/px/callButton" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "@$tmp"
  return $r | ConvertFrom-Json
}

$loginFile = Join-Path $env:TEMP 'yj-login-test.json'
if (-not (Test-Path $loginFile)) {
  [System.IO.File]::WriteAllText($loginFile, '{"userName":"admin","password":"123456","factory":"YJ_TEST"}', (New-Object System.Text.UTF8Encoding $false))
}
$login = (& curl.exe -s -X POST "$Base/api/auth/login" -H 'Content-Type: application/json' -d "@$loginFile") | ConvertFrom-Json
if ($login.code -ne 200) { Write-Output ("登录失败(" + $Base + "): " + ($login | ConvertTo-Json -Compress)); exit 1 }
$token = $login.data.token
Write-Output ("① 登录 " + $Base + " factory=" + $login.data.user.factory)

if (-not $DocNo) {
  $q = Call @{ panelCode='MATERIAL_OUT'; buttonName='查询可转ERP'; formData=@{}; buttonParam=@{} } $token
  $first = @($q.data.list)[0]
  if (-not $first) { Write-Output '② 可转ERP 列表为空,无可转单据'; exit 1 }
  $DocNo = $first.单据编号
}
Write-Output ("② 目标单据:" + $DocNo)

$q2 = Call @{ panelCode='MATERIAL_OUT'; buttonName='查询可转ERP'; formData=@{}; buttonParam=@{} } $token
Write-Output ("③ 查询可转ERP: code=" + $q2.code + " count=" + $q2.data.count + " → " + ((@($q2.data.list) | ForEach-Object { $_.单据编号 }) -join ', '))

$push = Call @{ panelCode='MATERIAL_OUT'; buttonName='转ERP'; formData=@{ 编号=$DocNo; 单据编号=$DocNo }; buttonParam=@{} } $token
Write-Output ("④ 转ERP: code=" + $push.code + " msg=" + $push.message)
Write-Output ("   data=" + ($push.data | ConvertTo-Json -Compress))
Write-Output "DOCNO=$DocNo"
