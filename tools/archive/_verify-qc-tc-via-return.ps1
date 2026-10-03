# _verify-qc-tc-via-return.ps1 — 特采改经暂收退料单 全链路验证(2026-10-04,含同日修订)
# 在**测试账套 YJ_TEST** 上跑(正式账套只录真实业务,不造数)。
#
# 口径(修订后):特采 = **暂收退料单明细行的 bool 字段(勾选)**,不是工具栏按钮;
#   来料检验单审核 → 合格行→采购入库单 / 不良行→暂收退料单(带送检数量、退货数量)
#   暂收退料单勾「特采」→ 审核/审批通过时,勾了的行逐行生成特采单(总数量=送检数量、不合格品数量=退货数量)
#   特采单两级审批通过 → 采购入库单(实收=特采单总数量,特采=是)
param([string]$Base = 'http://127.0.0.1:8090')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$script:token = $null
$script:fail = 0
function Ok($m)   { Write-Host "  [OK]   $m" -ForegroundColor Green }
function Bad($m)  { Write-Host "  [FAIL] $m" -ForegroundColor Red; $script:fail++ }
function Step($m) { Write-Host "`n== $m ==" -ForegroundColor Cyan }

function Api($method, $path, $body) {
  # ⚠ 不要用 $args 当局部变量:它是 PowerShell 自动变量,赋值后展开会静默失效(本脚本第一版就栽在这)
  $cargs = @('-s', '-X', $method, "$Base$path", '-H', 'Content-Type: application/json')
  if ($script:token) { $cargs += @('-H', "Authorization: Bearer $($script:token)") }
  $tmp = $null
  if ($null -ne $body) {
    $tmp = Join-Path $env:TEMP 'yj-tc-body.json'
    [System.IO.File]::WriteAllText($tmp, ($body | ConvertTo-Json -Depth 12 -Compress), (New-Object System.Text.UTF8Encoding $false))
    $cargs += @('-d', "@$tmp")
  }
  $raw = & curl.exe @cargs
  if ($tmp) { Remove-Item $tmp -ErrorAction SilentlyContinue }
  if (-not $raw) { throw "API $path 空响应" }
  return ($raw | ConvertFrom-Json)
}
function CallBtn($panel, $btn, $formData) {
  $r = Api 'POST' '/api/px/callButton' @{ panelCode = $panel; buttonName = $btn; formData = $formData; buttonParam = @{} }
  if ($r.code -ne 200) { throw "callButton $panel/$btn 失败: $($r.message)" }
  return $r.data
}
function CallBtnErr($panel, $btn, $formData) {
  $r = Api 'POST' '/api/px/callButton' @{ panelCode = $panel; buttonName = $btn; formData = $formData; buttonParam = @{} }
  if ($r.code -ne 200) { return [string]$r.message }
  return $null
}
# 直读测试库(断言用):与 DbSync 同款 JDBC
function Sql([string]$q) {
  $f = Join-Path $env:TEMP 'yj-tc-probe.sql'
  [System.IO.File]::WriteAllText($f, "SET NOCOUNT ON;`nGO`n$q`nGO`n", (New-Object System.Text.UTF8Encoding $false))
  $env:YINJIA_SQL_PASS = 'Yinjia@2026'
  Push-Location 'D:\YINJIA-main\tools'
  try {
    return (& java "-Dsun.stdout.encoding=UTF-8" -cp 'lib\mssql-jdbc.jar' SqlRunner.java `
        'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true' yinjia env $f 2>$null)
  } finally { Pop-Location }
}
function SqlOne([string]$q) {
  foreach ($line in (Sql $q)) {
    if ($line -match '^\s*\|\s*(.*?)\s*\|\s*$') { return $Matches[1] }
  }
  return $null
}

Step '1. 登录(测试账套 YJ_TEST)'
$login = Api 'POST' '/api/auth/login' @{ userName = 'admin'; password = '123456'; factory = 'YJ_TEST' }
if ($login.code -ne 200) { throw "登录失败: $($login.message)" }
$script:token = $login.data.token
Ok "登录成功 factory=$($login.data.user.factory) isAdmin=$($login.data.user.isAdmin)"

Step '2. 面板元数据:特采是明细 bool 字段、不是工具栏按钮'
$rc = Api 'GET' '/api/px/getPanelConfig?panelCode=QC_RETURN'
$groups = @($rc.data.metadata.buttonGroups)
if ($groups | Where-Object { $_.name -eq '特采' -or $_.actions -contains '特采' }) {
  Bad '暂收退料单工具栏仍有「特采」按钮组(应按口径删除)'
} else { Ok "工具栏已无「特采」按钮组(现有组: $(($groups | ForEach-Object { $_.name }) -join '/'))" }

$rfields = @($rc.data.detail.tabs[0].fields)
$tcCol = $rfields | Where-Object { $_.dataName -eq '特采' }
if ($tcCol) {
  if ($tcCol.dataType -eq '是否') { Ok '明细有「特采」字段且类型=是否(bool)' } else { Bad "「特采」类型=$($tcCol.dataType),应为 是否" }
  if (-not $tcCol.readonly -and -not $tcCol.hidden) { Ok '「特采」可勾选(可编辑、可见)' } else { Bad "「特采」不可编辑/不可见(readonly=$($tcCol.readonly) hidden=$($tcCol.hidden))" }
} else { Bad "暂收退料单明细没有「特采」字段(现有: $(($rfields | ForEach-Object { $_.dataName }) -join '/'))" }
$sendCol = $rfields | Where-Object { $_.dataName -eq '送检数量' }
if ($sendCol) {
  if ($sendCol.readonly) { Ok '明细「送检数量」只读(随链继承)' } else { Bad '「送检数量」应为只读' }
} else { Bad '明细没有「送检数量」字段' }

$ic = Api 'GET' '/api/px/getPanelConfig?panelCode=QC_INSP'
if (@($ic.data.detail.tabs[0].fields) | Where-Object { $_.dataName -eq '特采' }) {
  Bad '来料检验单仍有「特采」字段'
} else { Ok '来料检验单明细已无「特采」字段' }

Step '3. 造检验单(1 合格行 + 1 不良行)并审核'
$created = CallBtn 'QC_INSP' '保存' @{}
# ⚠ PS5.1:PSCustomObject 的**中文属性名只能用点号访问**,$obj['编号'] 恒为 $null(本脚本踩过)
$inspNo = $created.编号
if (-not $inspNo) { Bad '新建检验单草稿未返回编号'; throw '停止' }
Ok "新建检验单草稿 $inspNo"
$invA = 'Y-S-T'; $invB = 'Y-GL-300400'
CallBtn 'QC_INSP' '保存为草稿' @{
  编号 = $inspNo; 单据日期 = (Get-Date -Format 'yyyy-MM-dd'); 供应商 = '验证用供应商'; 业务员 = 'admin'
  detail = @{ items = @(
    @{ 物料编码 = $invA; 物料名称 = '验证料A'; 规格型号 = 'SPEC-A'; 送检数量 = 100; 合格数量 = 100; 不合格数量 = 0; 计量单位 = 'kg'; 单价 = 10 },
    @{ 物料编码 = $invB; 物料名称 = '验证料B'; 规格型号 = 'SPEC-B'; 送检数量 = 60;  合格数量 = 0;   不合格数量 = 20; 计量单位 = 'kg'; 单价 = 5 }
  ) }
} | Out-Null
$chk = SqlOne "SELECT COUNT(*) FROM qc_insp_detail WHERE 单据编号='$inspNo' AND ISNULL(asp_cancel,'N')<>'Y'"
if ($chk -eq '2') { Ok '检验单明细 2 行已保存' } else { Bad "检验单明细行数=$chk,应为 2" }
CallBtn 'QC_INSP' '审核' @{ 编号 = $inspNo } | Out-Null
Ok '检验单已审核'

$thNo = SqlOne "SELECT target_form_no FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no='$inspNo' AND target_panel_code='QC_RETURN' AND link_status='ACTIVE'"
if ($thNo) { Ok "自动生成暂收退料单 $thNo" } else { Bad '没有生成暂收退料单'; throw '停止:无退料单' }
$piNo0 = SqlOne "SELECT target_form_no FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no='$inspNo' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'"
if ($piNo0) { Ok "合格行自动生成采购入库单 $piNo0" } else { Bad '合格行没有生成采购入库单' }
if ((SqlOne "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no='$inspNo' AND target_panel_code='QC_TC_IN' AND link_status='ACTIVE'") -eq '0') {
  Ok '检验审核**不再**直接产特采单(口径已切换)'
} else { Bad '检验审核仍直接产了特采单' }
$sendQty = SqlOne "SELECT 送检数量 FROM qc_return_detail WHERE 单据编号='$thNo' AND 物料编码='$invB'"
$retQty  = SqlOne "SELECT 退货数量 FROM qc_return_detail WHERE 单据编号='$thNo' AND 物料编码='$invB'"
if ($sendQty -like '60*') { Ok "退料行记录了送检数量=$sendQty(检验行 60)" } else { Bad "退料行送检数量=$sendQty,应为 60" }
if ($retQty -like '20*')  { Ok "退料行退货数量=$retQty(检验行不良 20)" } else { Bad "退料行退货数量=$retQty,应为 20" }

Step '4. 闸门:明细没勾特采 → 审核不生特采单'
CallBtn 'QC_RETURN' '审核' @{ 编号 = $thNo } | Out-Null
$n1 = SqlOne "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_RETURN' AND source_form_no='$thNo' AND target_panel_code='QC_TC_IN' AND link_status='ACTIVE'"
if ($n1 -eq '0') { Ok '未勾选时不生成特采单(勾选才是发起方式)' } else { Bad "未勾选却生成了 $n1 张特采单" }
CallBtn 'QC_RETURN' '弃审' @{ 编号 = $thNo } | Out-Null
Ok '已弃审,回到草稿(为下一步勾选做准备)'

Step '5. 明细勾「特采」→ 审核时逐行生成特采单'
$fd = Api 'GET' "/api/px/getFormDescriptor?panelCode=QC_RETURN&code=$thNo"
$head = $fd.data.data
$items = @($fd.data.detailData.items)
if ($items.Count -lt 1) { Bad '退料单没有明细行'; throw '停止' }
# 勾上第一行(与 UI 勾复选框同一条保存路径:formDescriptor 取数 → 改字段 → 保存为草稿)
$items[0].特采 = $true
$saveForm = @{ 编号 = $thNo; detail = @{ items = $items } }
foreach ($k in @('单据日期','供应商','检验单号','采购订单号','批次号','退货类型','仓库','退货原因','经手人')) {
  if ($null -ne $head.$k) { $saveForm[$k] = $head.$k }
}
CallBtn 'QC_RETURN' '保存为草稿' $saveForm | Out-Null
$flag = SqlOne "SELECT CAST(ISNULL(特采,0) AS int) FROM qc_return_detail WHERE 单据编号='$thNo' AND 物料编码='$invB'"
if ($flag -eq '1') { Ok '「特采」bool 字段已通过保存路径落库 = 1' } else { Bad "特采字段=$flag,应为 1" }
CallBtn 'QC_RETURN' '审核' @{ 编号 = $thNo } | Out-Null
Ok '退料单已审核'
$tcNo = SqlOne "SELECT target_form_no FROM form_flow_link WHERE source_panel_code='QC_RETURN' AND source_form_no='$thNo' AND target_panel_code='QC_TC_IN' AND link_status='ACTIVE'"
if ($tcNo) { Ok "勾选行生成了特采单 $tcNo" } else { Bad '勾了特采却没有生成特采单' }
$tot = SqlOne "SELECT 总数量 FROM qc_tc_in WHERE 单据编号='$tcNo'"
$bad = SqlOne "SELECT 不合格品数量 FROM qc_tc_in WHERE 单据编号='$tcNo'"
$thRef = SqlOne "SELECT 暂收退料单号 FROM qc_tc_in WHERE 单据编号='$tcNo'"
$inspRef = SqlOne "SELECT 检验单号 FROM qc_tc_in WHERE 单据编号='$tcNo'"
$prodName = SqlOne "SELECT 产品名称 FROM qc_tc_in WHERE 单据编号='$tcNo'"
if ($tot -like '60*') { Ok "特采单总数量=$tot(= 退料行送检数量 60)" } else { Bad "特采单总数量=$tot,应为 60(+单位)" }
if ($bad -like '20*') { Ok "特采单不合格品数量=$bad(= 退料行退货数量 20)" } else { Bad "特采单不合格品数量=$bad,应为 20" }
if ($prodName -eq '验证料B') { Ok "特采单产品名称=$prodName" } else { Bad "特采单产品名称=$prodName" }
if ($thRef -eq $thNo) { Ok "特采单头回记暂收退料单号=$thRef" } else { Bad "特采单暂收退料单号=$thRef,应为 $thNo" }
if ($inspRef -eq $inspNo) { Ok "特采单头回记检验单号=$inspRef" } else { Bad "特采单检验单号=$inspRef,应为 $inspNo" }

Step '6. 幂等:弃审再审核,不应生出两张特采单'
CallBtn 'QC_RETURN' '弃审' @{ 编号 = $thNo } | Out-Null
$void1 = SqlOne "SELECT ISNULL(canceled,'N') FROM yj_doc_status WHERE panel_code='QC_TC_IN' AND doc_no='$tcNo'"
if ($void1 -eq 'Y') { Ok '草稿特采单随退料单弃审一并作废' } else { Bad "特采单未作废(canceled=$void1)" }
CallBtn 'QC_RETURN' '审核' @{ 编号 = $thNo } | Out-Null
$cnt = SqlOne "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_RETURN' AND source_form_no='$thNo' AND target_panel_code='QC_TC_IN' AND link_status='ACTIVE'"
$tcNo2 = SqlOne "SELECT target_form_no FROM form_flow_link WHERE source_panel_code='QC_RETURN' AND source_form_no='$thNo' AND target_panel_code='QC_TC_IN' AND link_status='ACTIVE'"
if ($cnt -eq '1') { Ok "重审后仍只有 1 张特采单($tcNo2)" } else { Bad "重审后 ACTIVE 特采单数=$cnt,应为 1" }
if ($tcNo2 -eq $tcNo) { Ok '复用同一张特采单号(行级占用释放后按同号重建)' } else { Ok "生成了新的特采单 $tcNo2(原 $tcNo 已作废)" }
$tcNo = $tcNo2

Step '7. 特采单两级审批通过 → 采购入库单(特采=是)'
CallBtn 'QC_TC_IN' '提交审批' @{ 编号 = $tcNo } | Out-Null
Ok '已提交审批'
CallBtn 'QC_TC_IN' '审批通过' @{ 编号 = $tcNo } | Out-Null
$st1 = SqlOne "SELECT approve_node FROM yj_doc_status WHERE panel_code='QC_TC_IN' AND doc_no='$tcNo'"
Ok "一级审批通过(approve_node=$st1)"
CallBtn 'QC_TC_IN' '审批通过' @{ 编号 = $tcNo } | Out-Null
Ok '超级管理员批准通过'
$piNo = SqlOne "SELECT target_form_no FROM form_flow_link WHERE source_panel_code='QC_TC_IN' AND source_form_no='$tcNo' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'"
if ($piNo) { Ok "特采单审批通过 → 采购入库单 $piNo" } else { Bad '特采单审批通过后没有生成采购入库单' }
if ($piNo) {
  $piQty  = SqlOne "SELECT 实收数量 FROM bl_purchase_in WHERE 单据编号='$piNo'"
  $piTc   = SqlOne "SELECT 特采 FROM bl_purchase_in WHERE 单据编号='$piNo'"
  $piInsp = SqlOne "SELECT 是否来料检验 FROM bl_purchase_in WHERE 单据编号='$piNo'"
  if ($piQty -like '60*') { Ok "入库行实收数量=$piQty(= 特采单总数量 60)" } else { Bad "入库行实收数量=$piQty,应为 60" }
  if ($piTc -eq '是') { Ok '入库行特采=是' } else { Bad "入库行特采=$piTc,应为 是" }
  if ($piInsp -eq '是') { Ok '入库行是否来料检验=是' } else { Bad "入库行是否来料检验=$piInsp,应为 是" }
}

Step '8. 弃审级联:特采单已审核(已生成入库单)时,弃审退料单必须被挡'
$err3 = CallBtnErr 'QC_RETURN' '弃审' @{ 编号 = $thNo }
if ($err3 -and $err3 -match '已审核') { Ok "已挡弃审:$err3" } else { Bad "未挡住(返回: $err3)" }

Write-Host ''
if ($script:fail -eq 0) { Write-Host 'RESULT: PASS' -ForegroundColor Green; exit 0 }
Write-Host "RESULT: FAIL-$($script:fail)" -ForegroundColor Red; exit 1
