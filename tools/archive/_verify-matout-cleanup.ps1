# 收尾:清掉 E2E 造数(弃审→删除) + 回归其它三个转ERP面板的「查询可转ERP」
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://127.0.0.1:8090'
function Call($body, $token) {
  $tmp = Join-Path $env:TEMP 'yj-cleanup.json'
  [System.IO.File]::WriteAllText($tmp, ($body | ConvertTo-Json -Depth 12 -Compress), (New-Object System.Text.UTF8Encoding $false))
  (& curl.exe -s -X POST "$base/api/px/callButton" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "@$tmp") | ConvertFrom-Json
}
$token = ((& curl.exe -s -X POST "$base/api/auth/login" -H 'Content-Type: application/json' -d "@$env:TEMP\yj-login-test.json") | ConvertFrom-Json).data.token

Write-Output '== 清理 E2E 造数(测试账套)=='
foreach ($no in @('CL-2026-09-0001','CL-2026-09-0002')) {
  $u = Call @{ panelCode='MATERIAL_OUT'; buttonName='弃审'; formData=@{ 编号=$no; 单据编号=$no }; buttonParam=@{} } $token
  Write-Output ("  弃审 $no : code=" + $u.code + " " + $u.message)
  $d = Call @{ panelCode='MATERIAL_OUT'; buttonName='删除'; formData=@{ 编号=$no; 单据编号=$no }; buttonParam=@{} } $token
  Write-Output ("  删除 $no : code=" + $d.code + " " + $d.message)
}

Write-Output '== 回归:其它三个面板的 查询可转ERP =='
foreach ($p in @('PURCHASE_IN','SALE_OUT','PU_ORDER')) {
  $r = Call @{ panelCode=$p; buttonName='查询可转ERP'; formData=@{}; buttonParam=@{} } $token
  Write-Output ("  $p : code=" + $r.code + " count=" + $r.data.count + " " + $r.message)
}
Write-Output '== 回归:材料出库单面板仍可列表查询(新列不破坏取数)=='
$r = Call @{ panelCode='MATERIAL_OUT'; buttonName='查询可转ERP'; formData=@{}; buttonParam=@{} } $token
Write-Output ("  MATERIAL_OUT 转ERP候选: code=" + $r.code + " count=" + $r.data.count)
