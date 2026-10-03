# _verify-qc-tc-via-return.ps1 — 特采改经暂收退料单 全链路验证(2026-10-04)
# 在**测试账套 YJ_TEST** 上跑(正式账套只录真实业务,不造数)。
# 链路:来料检验单审核 → 暂收退料单(带送检数量) → [未审核点特采=拒] → 审核 → [特采按钮]
#       → 特采单(总数量=送检数量) → 提交审批 → 一级通过 → 超级管理员批准 → 采购入库单(特采=是)
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

Step '2. 面板元数据:特采按钮 / 送检数量字段 / 检验单特采字段已下线'
$rc = Api 'GET' '/api/px/getPanelConfig?panelCode=QC_RETURN'
$groups = @($rc.data.metadata.buttonGroups)
$tcGroup = $groups | Where-Object { $_.name -eq '特采' }
if ($tcGroup) { Ok "暂收退料单按钮组含「特采」(动作: $($tcGroup.actions -join ','))" }
else { Bad "暂收退料单没有「特采」按钮组(现有组: $(($groups | ForEach-Object { $_.name }) -join '/'))" }
$dis = @($rc.data.metadata.disabledActions)
if ($dis -contains '特采') { Bad '「特采」被标成灰色占位(disabledActions)' } else { Ok '「特采」不是灰色占位' }

$rfields = @($rc.data.detail.tabs[0].fields)
$sendCol = $rfields | Where-Object { $_.dataName -eq '送检数量' }
if ($sendCol) {
  if ($sendCol.readonly) { Ok '暂收退料单明细列含「送检数量」且只读(readonly=true)' }
  else { Bad "「送检数量」可编辑(readonly=$($sendCol.readonly))" }
} else { Bad "暂收退料单明细没有「送检数量」列(现有: $(($rfields | ForEach-Object { $_.dataName }) -join '/'))" }

$ic = Api 'GET' '/api/px/getPanelConfig?panelCode=QC_INSP'
$icols = @($ic.data.detail.tabs[0].fields) | Where-Object { $_.dataName -eq '特采' }
if ($icols.Count -eq 0) { Ok '来料检验单明细已无「特采」字段' } else { Bad '来料检验单仍有「特采」字段' }

Step '3. 造一张来料检验单(1 行合格 + 1 行不良,各带送检数量)并审核'
$created = CallBtn 'QC_INSP' '保存' @{}
# ⚠ PS5.1:PSCustomObject 的**中文属性名只能用点号访问**,$obj['编号'] 恒为 $null(本脚本踩过)
$inspNo = $created.编号
if (-not $inspNo) { Bad '新建检验单草稿未返回编号'; throw '停止' }
Ok "新建检验单草稿 $inspNo"
$invA = 'Y-S-T'; $invB = 'Y-GL-300400'
$inspForm = @{
  编号 = $inspNo
  单据日期 = (Get-Date -Format 'yyyy-MM-dd')
  供应商 = '验证用供应商'
  业务员 = 'admin'
  detail = @{ items = @(
    @{ 物料编码 = $invA; 物料名称 = '验证料A'; 规格型号 = 'SPEC-A'; 送检数量 = 100; 合格数量 = 100; 不合格数量 = 0; 计量单位 = 'kg'; 单价 = 10 },
    @{ 物料编码 = $invB; 物料名称 = '验证料B'; 规格型号 = 'SPEC-B'; 送检数量 = 60;  合格数量 = 0;   不合格数量 = 20; 计量单位 = 'kg'; 单价 = 5 }
  ) }
}
CallBtn 'QC_INSP' '保存为草稿' $inspForm | Out-Null
$chk = SqlOne "SELECT COUNT(*) FROM qc_insp_detail WHERE 单据编号='$inspNo' AND ISNULL(asp_cancel,'N')<>'Y'"
if ($chk -eq '2') { Ok '检验单明细 2 行已保存' } else { Bad "检验单明细行数=$chk,应为 2" }
CallBtn 'QC_INSP' '审核' @{ 编号 = $inspNo } | Out-Null
Ok '检验单已审核'

$thNo = SqlOne "SELECT target_form_no FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no='$inspNo' AND target_panel_code='QC_RETURN' AND link_status='ACTIVE'"
if ($thNo) { Ok "自动生成暂收退料单 $thNo" } else { Bad '没有生成暂收退料单'; throw '停止:无退料单' }
$piNo0 = SqlOne "SELECT target_form_no FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no='$inspNo' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'"
if ($piNo0) { Ok "合格行自动生成采购入库单 $piNo0" } else { Bad '合格行没有生成采购入库单' }
$tcAuto = SqlOne "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no='$inspNo' AND target_panel_code='QC_TC_IN' AND link_status='ACTIVE'"
if ($tcAuto -eq '0') { Ok '检验审核**不再**直接产特采单(口径已切换)' } else { Bad "检验审核仍直接产了 $tcAuto 张特采单" }

$sendQty = SqlOne "SELECT 送检数量 FROM qc_return_detail WHERE 单据编号='$thNo' AND 物料编码='$invB'"
$retQty  = SqlOne "SELECT 退货数量 FROM qc_return_detail WHERE 单据编号='$thNo' AND 物料编码='$invB'"
if ($sendQty -like '60*') { Ok "退料行记录了送检数量=$sendQty(检验行 60)" } else { Bad "退料行送检数量=$sendQty,应为 60" }
if ($retQty -like '20*')  { Ok "退料行退货数量=$retQty(检验行不良 20)" } else { Bad "退料行退货数量=$retQty,应为 20" }

Step '4. 闸门:退料单未审核时点「特采」应被拒'
$err = CallBtnErr 'QC_RETURN' '特采' @{ 编号 = $thNo }
if ($err -and $err -match '审核') { Ok "已拦截:$err" } else { Bad "未拦截(返回: $err)" }
$tcLeak = SqlOne "SELECT COUNT(*) FROM form_flow_link WHERE source_panel_code='QC_RETURN' AND source_form_no='$thNo' AND target_panel_code='QC_TC_IN' AND link_status='ACTIVE'"
if ($tcLeak -eq '0') { Ok '被拒时没有留下任何特采单链路' } else { Bad "被拒却生成了 $tcLeak 条特采链路" }

Step '5. 退料单审核 → 点「特采」逐行生成特采单'
CallBtn 'QC_RETURN' '审核' @{ 编号 = $thNo } | Out-Null
Ok '退料单已审核'
$r = CallBtn 'QC_RETURN' '特采' @{ 编号 = $thNo }
$made = @($r.特采单号)
if ($made.Count -ge 1) { Ok "生成特采单 $($made -join '、')(张数 $($r.张数))" } else { Bad '没有返回特采单号' }
$tcNo = $made[0]
$tot = SqlOne "SELECT 总数量 FROM qc_tc_in WHERE 单据编号='$tcNo'"
$bad = SqlOne "SELECT 不合格品数量 FROM qc_tc_in WHERE 单据编号='$tcNo'"
$thRef = SqlOne "SELECT 暂收退料单号 FROM qc_tc_in WHERE 单据编号='$tcNo'"
$inspRef = SqlOne "SELECT 检验单号 FROM qc_tc_in WHERE 单据编号='$tcNo'"
$prodName = SqlOne "SELECT 产品名称 FROM qc_tc_in WHERE 单据编号='$tcNo'"
if ($tot -like '60*') { Ok "特采单总数量=$tot(= 退料行送检数量 60)" } else { Bad "特采单总数量=$tot,应为 60(+单位)" }
if ($bad -like '20*') { Ok "特采单不合格品数量=$bad(= 退料行退货数量 20)" } else { Bad "特采单不合格品数量=$bad,应为 20" }
if ($prodName -eq '验证料B') { Ok "特采单产品名称=$prodName" } else { Bad "特采单产品名称=$prodName,应为 验证料B" }
if ($thRef -eq $thNo) { Ok "特采单头回记暂收退料单号=$thRef" } else { Bad "特采单暂收退料单号=$thRef,应为 $thNo" }
if ($inspRef -eq $inspNo) { Ok "特采单头回记检验单号=$inspRef" } else { Bad "特采单检验单号=$inspRef,应为 $inspNo" }

Step '6. 幂等:再点一次「特采」应提示已生成'
$err2 = CallBtnErr 'QC_RETURN' '特采' @{ 编号 = $thNo }
if ($err2 -and $err2 -match '已生成过|无需重复') { Ok "重复点击被拦:$err2" } else { Bad "重复点击未拦(返回: $err2)" }

Step '7. 特采单两级审批通过 → 自动生成采购入库单(特采=是)'
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

Step '8. 弃审级联:退料单弃审 → 它生成的特采单草稿一并作废;特采单已审核则挡弃审'
# 8a) 新造一条链,退料单审核 → 特采(留下**草稿**特采单)→ 弃审退料单:应级联作废特采单
$c2 = CallBtn 'QC_INSP' '保存' @{}
$insp2 = $c2.编号
CallBtn 'QC_INSP' '保存为草稿' @{
  编号 = $insp2; 单据日期 = (Get-Date -Format 'yyyy-MM-dd'); 供应商 = '验证用供应商'; 业务员 = 'admin'
  detail = @{ items = @(
    @{ 物料编码 = $invB; 物料名称 = '验证料B'; 规格型号 = 'SPEC-B'; 送检数量 = 60; 合格数量 = 0; 不合格数量 = 20; 计量单位 = 'kg'; 单价 = 5 }
  ) }
} | Out-Null
CallBtn 'QC_INSP' '审核' @{ 编号 = $insp2 } | Out-Null
$th2 = SqlOne "SELECT target_form_no FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no='$insp2' AND target_panel_code='QC_RETURN' AND link_status='ACTIVE'"
if (-not $th2) { Bad '8a 未生成退料单' } else {
  CallBtn 'QC_RETURN' '审核' @{ 编号 = $th2 } | Out-Null
  $rr = CallBtn 'QC_RETURN' '特采' @{ 编号 = $th2 }
  $tcDraft = @($rr.特采单号)[0]
  Ok "8a 新链退料单 $th2 → 特采单草稿 $tcDraft"
  CallBtn 'QC_RETURN' '弃审' @{ 编号 = $th2 } | Out-Null
  # 作废口径 = yj_doc_status.canceled='Y'(全系统软删口径;单据表 asp_cancel 不由 voidDoc 改,见 ButtonService.voidDoc)
  $stTc = SqlOne "SELECT ISNULL(canceled,'N') FROM yj_doc_status WHERE panel_code='QC_TC_IN' AND doc_no='$tcDraft'"
  $lk = SqlOne "SELECT link_status FROM form_flow_link WHERE source_panel_code='QC_RETURN' AND source_form_no='$th2' AND target_panel_code='QC_TC_IN' AND target_form_no='$tcDraft'"
  $stTh = SqlOne "SELECT ISNULL(sh.shr,'') FROM yj_doc_status sh WHERE sh.panel_code='QC_RETURN' AND sh.doc_no='$th2'"
  if ($stTc -eq 'Y') { Ok '8a 草稿特采单已随退料单弃审一并作废(yj_doc_status.canceled=Y)' } else { Bad "8a 特采单未被作废(canceled=$stTc)" }
  if ($lk -eq 'RELEASED') { Ok '8a 占用链路已释放(RELEASED)' } else { Bad "8a 链路状态=$lk,应为 RELEASED" }
  if (-not $stTh) { Ok '8a 退料单已回到草稿' } else { Bad "8a 退料单审核人仍为 $stTh" }
}
# 8b) 特采单已审核(已生成入库单)时弃审退料单:必须被挡(先弃下游)
if ($piNo) {
  $err3 = CallBtnErr 'QC_RETURN' '弃审' @{ 编号 = $thNo }
  if ($err3 -and $err3 -match '已审核') { Ok "8b 已挡弃审:$err3" } else { Bad "8b 未挡住(返回: $err3)" }
}

Write-Host ''
if ($script:fail -eq 0) { Write-Host 'RESULT: PASS' -ForegroundColor Green; exit 0 }
Write-Host "RESULT: FAIL-$($script:fail)" -ForegroundColor Red; exit 1
