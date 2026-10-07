# 端到端:测试账套建一张材料出库单 → 审核 → 转ERP(验证 MATERIAL_OUT 分支走到金蝶边界)
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://127.0.0.1:8090'
function Call($body, $token) {
  $tmp = Join-Path $env:TEMP 'yj-e2e.json'
  [System.IO.File]::WriteAllText($tmp, ($body | ConvertTo-Json -Depth 12 -Compress), (New-Object System.Text.UTF8Encoding $false))
  $r = & curl.exe -s -X POST "$base/api/px/callButton" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "@$tmp"
  return $r | ConvertFrom-Json
}
$login = (& curl.exe -s -X POST "$base/api/auth/login" -H 'Content-Type: application/json' -d "@$env:TEMP\yj-login-test.json") | ConvertFrom-Json
$token = $login.data.token
Write-Output "登录(测试账套): $($login.data.user.factory)"

$form = @{
  panelCode = 'MATERIAL_OUT'
  buttonName = '保存'
  formData = @{
    单据日期 = '2026-09-28'
    业务类型 = '材料出库'
    出库类别 = '直接领料'
    生产车间 = '烧结车间'
    领用人   = '白兴发'
    仓库     = '华北工控仓'
    备注     = 'E2E 转ERP 验证(测试账套造数,可弃)'
    detail   = @{ items = @(
      @{ 材料编码='YJ-SX-031'; 材料名称='大端盖'; 规格型号='Φ120'; 计量单位='个'; 数量=10; 批号='PC0000'; 仓库='华北工控仓'; 明细备注='E2E 行1' }
    ) }
  }
  buttonParam = @{}
}
$save = Call $form $token
Write-Output ("保存: code=" + $save.code + " 编号=" + $save.data.编号 + " " + $save.message)
$no = $save.data.编号
if (-not $no) { exit 1 }

foreach ($b in @('提交审批','审批通过')) {
  $r = Call @{ panelCode='MATERIAL_OUT'; buttonName=$b; formData=@{ 编号=$no; 单据编号=$no }; buttonParam=@{} } $token
  Write-Output ("$b : code=" + $r.code + " " + $r.message)
}
$q = Call @{ panelCode='MATERIAL_OUT'; buttonName='查询可转ERP'; formData=@{}; buttonParam=@{} } $token
Write-Output ("查询可转ERP: count=" + $q.data.count + " → " + (($q.data.list | ForEach-Object { $_.单据编号 + '(' + $_.往来单位 + ')' }) -join ', '))

$push = Call @{ panelCode='MATERIAL_OUT'; buttonName='转ERP'; formData=@{ 编号=$no; 单据编号=$no }; buttonParam=@{} } $token
Write-Output ("转ERP : code=" + $push.code + " msg=" + $push.message + " data=" + ($push.data | ConvertTo-Json -Compress))
Write-Output "DOCNO=$no"
