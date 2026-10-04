# _e2e-matout-erp-test-ledger.ps1 — 材料出库单「转ERP」端到端(测试账套 HSDZ_MES_TEST → 金蝶目标)
# 流程:登录(工厂 YJ_TEST)→ 保存一张材料出库单 → 提交审批 → 审批通过 → 查询可转ERP → 转ERP
# 只写测试账套;金蝶侧写不写取决于后端凭证(当前=测试沙箱静态密钥)。
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://127.0.0.1:8090'
function Call([hashtable]$body, [string]$token) {
  $tmp = Join-Path $env:TEMP 'yj-matout-e2e-body.json'
  [System.IO.File]::WriteAllText($tmp, ($body | ConvertTo-Json -Depth 12 -Compress), (New-Object System.Text.UTF8Encoding $false))
  $r = & curl.exe -s -X POST "$base/api/px/callButton" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "@$tmp"
  return $r | ConvertFrom-Json
}
$loginFile = Join-Path $env:TEMP 'yj-login-test.json'
if (-not (Test-Path $loginFile)) {
  [System.IO.File]::WriteAllText($loginFile, '{"userName":"admin","password":"123456","factory":"YJ_TEST"}', (New-Object System.Text.UTF8Encoding $false))
}
$login = (& curl.exe -s -X POST "$base/api/auth/login" -H 'Content-Type: application/json' -d "@$loginFile") | ConvertFrom-Json
if ($login.code -ne 200) { Write-Output ("登录失败: " + ($login | ConvertTo-Json -Compress)); exit 1 }
$token = $login.data.token
Write-Output ("① 登录: factory=" + $login.data.user.factory + " user=" + $login.data.user.userName)

$form = @{
  panelCode = 'MATERIAL_OUT'
  buttonName = '保存'
  formData = @{
    单据日期 = (Get-Date -Format 'yyyy-MM-dd')
    业务类型 = '材料出库'
    出库类别 = '直接领料'
    生产车间 = '烧结车间'
    领用人   = '白兴发'
    仓库     = '华北工控仓'
    备注     = '2026-10-04 转ERP 端到端验证(测试账套造数)'
    detail   = @{ items = @(
      @{ 材料编码='YJ-SX-031'; 材料名称='大端盖'; 规格型号='Φ120'; 计量单位='个'; 数量=10; 批号='PC0000'; 仓库='华北工控仓'; 明细备注='转ERP 验证行' }
    ) }
  }
  buttonParam = @{}
}
$save = Call $form $token
Write-Output ("② 保存: code=" + $save.code + " 编号=" + $save.data.编号 + " " + $save.message)
$no = $save.data.编号
if (-not $no) { Write-Output ("保存失败: " + ($save | ConvertTo-Json -Compress -Depth 6)); exit 1 }

foreach ($b in @('提交审批', '审批通过')) {
  $r = Call @{ panelCode='MATERIAL_OUT'; buttonName=$b; formData=@{ 编号=$no; 单据编号=$no }; buttonParam=@{} } $token
  Write-Output ("③ $b : code=" + $r.code + " " + $r.message)
}
$q = Call @{ panelCode='MATERIAL_OUT'; buttonName='查询可转ERP'; formData=@{}; buttonParam=@{} } $token
Write-Output ("④ 查询可转ERP: code=" + $q.code + " count=" + $q.data.count + " → " + (($q.data.list | ForEach-Object { $_.单据编号 }) -join ', '))

$push = Call @{ panelCode='MATERIAL_OUT'; buttonName='转ERP'; formData=@{ 编号=$no; 单据编号=$no }; buttonParam=@{} } $token
Write-Output ("⑤ 转ERP: code=" + $push.code + " msg=" + $push.message)
Write-Output ("   data=" + ($push.data | ConvertTo-Json -Compress))
Write-Output "DOCNO=$no"
