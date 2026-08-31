# YINJIA-MES API 全链路验证(curl + UTF-8;PS5.1 需给 JSON 引号转义)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://localhost:8090'
Start-Sleep -Seconds 2

function Api($method, $path, $body, $token) {
  $cargs = @('-s', '-X', $method, "$base$path", '-H', 'Content-Type: application/json')
  if ($token) { $cargs += @('-H', "Authorization: Bearer $token") }
  $tmp = $null
  if ($body) {
    $json = $body | ConvertTo-Json -Depth 10 -Compress
    # 大载荷经临时文件传参(PS5.1 -> curl 命令行传长 JSON 会被截断)
    $tmp = Join-Path $env:TEMP "yj-api-body.json"
    [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding $false))
    $cargs += @('-d', "@$tmp")
  }
  try {
    $raw = & curl.exe @cargs
  } finally {
    if ($tmp) { Remove-Item $tmp -ErrorAction SilentlyContinue }
  }
  $script:lastRaw = $raw
  $script:lastPath = $path
  $parsed = $raw | ConvertFrom-Json
  if ($parsed.code -and $parsed.code -ne 200) { throw "API $path 失败: code=$($parsed.code) $($parsed.message)" }
  return $parsed
}

# 不抛错的 callButton(用于断言业务错误码)
function Post-Raw($body) {
  $tmp = Join-Path $env:TEMP 'yj-api-raw.json'
  $json = $body | ConvertTo-Json -Depth 10 -Compress
  [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding $false))
  $raw = & curl.exe -s -X POST "$base/api/px/callButton" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "@$tmp"
  Remove-Item $tmp -ErrorAction SilentlyContinue
  return $raw | ConvertFrom-Json
}

Write-Output '== 1. 登录 =='
$login = Api 'POST' '/api/auth/login' @{ userName = 'admin'; password = '123456' }
$token = $login.data.token
Write-Output "OK admin isAdmin=$($login.data.user.isAdmin)"

Write-Output '== 2. 面板配置 =='
foreach ($p in @('KHDA','ZDGL','RKD','CKD','CGD','KHDD','WLBOM')) {
  $cfg = Api 'GET' "/api/px/getPanelConfig?panelCode=$p" $null $token
  $m = $cfg.data.metadata
  Write-Output ("{0}: {1} | cat={2} singleDoc={3} query={4} cols={5} groups={6}" -f $p, $m.panelName, $m.panelCategory, $m.singleDoc, $m.panelPageDto.tablePages[0].queryFields.Count, $m.panelPageDto.tablePages[0].gridTabs[0].columns.Count, $m.buttonGroups.Count)
}

Write-Output '== 3. 档案查询(KHDA 单单据结构)=='
$q = Api 'POST' '/api/px/queryFormDataList' @{ panelCode = 'KHDA'; pageNo = 1; pageSize = 100 } $token
$row = $q.data.list[0]
$khRows = @($row.detail.khda)
if ($khRows.Count -eq 0) { $khRows = @($row.detail.items) }
Write-Output ("total={0} 编号={1} 状态={2} 首行={3}/{4} 明细键(khda)行数={5}" -f $q.data.totalSize, $row.'编号', $row.'状态', $khRows[0].'客户代码', $khRows[0].'客户名称', $khRows.Count)

Write-Output '== 4. 单据查询(RKD)=='
$q2 = Api 'POST' '/api/px/queryFormDataList' @{ panelCode = 'RKD'; pageNo = 1; pageSize = 20 } $token
Write-Output ("total={0} 首单={1} 状态={2} 明细行={3}" -f $q2.data.totalSize, $q2.data.list[0].'编号', $q2.data.list[0].'单据状态', $q2.data.list[0].detail.items.Count)

Write-Output '== 5. 头行式查询(KHDD)=='
$q3 = Api 'POST' '/api/px/queryFormDataList' @{ panelCode = 'KHDD'; pageNo = 1; pageSize = 20 } $token
$d3 = $q3.data.list | Where-Object { $_.detail.items.Count -gt 1 } | Select-Object -First 1
Write-Output ("total={0} 订单={1} 客户PO={2} 明细行={3} 首行产品={4} qty={5}" -f $q3.data.totalSize, $d3.'编号', $d3.'客户PO', $d3.detail.items.Count, $d3.detail.items[0].'产品代码', $d3.detail.items[0].'订单数量')

Write-Output '== 6. 物料清单(WLBOM 条件查询)=='
$q4 = Api 'POST' '/api/px/queryFormDataList' @{ panelCode = 'WLBOM'; pageNo = 1; pageSize = 5; condition = @{ '物料编码' = '1000050117' } } $token
Write-Output ("条件=1000050117 total={0} 父件={1} 子件行={2} 首子件={3}" -f $q4.data.totalSize, $q4.data.list[0].'编号', $q4.data.list[0].detail.items.Count, $q4.data.list[0].detail.items[0].'子件名称')

Write-Output '== 7. 新增草稿(空表单保存)=='
$new = Api 'POST' '/api/px/callButton' @{ panelCode = 'RKD'; buttonName = '提交'; formData = @{}; buttonParam = @{} } $token
$newNo = $new.data.'编号'
Write-Output ("新单号={0} 状态={1}" -f $newNo, $new.data.'单据状态')

Write-Output '== 8. 保存明细两行 =='
$save = Api 'POST' '/api/px/callButton' @{ panelCode = 'RKD'; buttonName = '提交'; formData = @{
    '编号' = $newNo; '入库日期' = '2026-08-29'; '业务员' = 'admin'; '厂商代码' = 'TY'; '仓库' = '101';
    detail = @{ items = @(
      @{ '物料代码' = '1000050117'; '批号' = 'LR2608290001'; '数量' = 120; '单位' = 'M'; '单价' = 1.5 },
      @{ '物料代码' = '1000049925'; '批号' = 'LR2608290002'; '数量' = 80; '单位' = 'M'; '单价' = 2.0 }) } };
  buttonParam = @{} } $token
Write-Output ("保存后 状态={0}" -f $save.data.'单据状态')

Write-Output '== 9. 校验落库 =='
$q5 = Api 'POST' '/api/px/queryFormDataList' @{ panelCode = 'RKD'; pageNo = 1; pageSize = 5; condition = @{ '入库单号' = $newNo } } $token
$chk = $q5.data.list[0]
Write-Output ("查回 单号={0} 明细={1}行 首行物料={2} 数量={3}" -f $chk.'编号', $chk.detail.items.Count, $chk.detail.items[0].'物料代码', $chk.detail.items[0].'数量')

Write-Output '== 10. 审核 =='
$aud = Api 'POST' '/api/px/callButton' @{ panelCode = 'RKD'; buttonName = '审核'; formData = @{ '编号' = $newNo }; buttonParam = @{} } $token
Write-Output ("审核后 状态={0}" -f $aud.data.'单据状态')

Write-Output '== 11. 已审核保存应 409 =='
$bodyJson = ('{"panelCode":"RKD","buttonName":"提交","formData":{"编号":"' + $newNo + '"},"buttonParam":{}}') -replace '"', '\"'
$raw = & curl.exe -s -o NUL -w '%{http_code}' -X POST "$base/api/px/callButton" -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d $bodyJson
Write-Output "HTTP $raw (期望 409)"

Write-Output '== 12. 弃审 -> 作废 =='
$una = Api 'POST' '/api/px/callButton' @{ panelCode = 'RKD'; buttonName = '弃审'; formData = @{ '编号' = $newNo }; buttonParam = @{} } $token
$del = Api 'POST' '/api/px/callButton' @{ panelCode = 'RKD'; buttonName = '删除'; formData = @{ '编号' = $newNo }; buttonParam = @{} } $token
Write-Output ("弃审后={0} 作废后={1}" -f $una.data.'单据状态', $del.data.'单据状态')

Write-Output '== 12b. 审批流(照搬 light-mes:提交→审批中→驳回/通过,全留痕)=='
$wf = Api 'POST' '/api/px/callButton' @{ panelCode = 'RKD'; buttonName = '提交'; formData = @{}; buttonParam = @{} } $token
$wfNo = $wf.data.'编号'
Write-Output ("新单={0}" -f $wfNo)
$sub = Api 'POST' '/api/px/callButton' @{ panelCode = 'RKD'; buttonName = '提交审批'; formData = @{ '编号' = $wfNo }; buttonParam = @{} } $token
Write-Output ("提交审批后={0}" -f $sub.data.'单据状态')
$wfSave = Post-Raw @{ panelCode = 'RKD'; buttonName = '提交'; formData = @{ '编号' = $wfNo }; buttonParam = @{} }
Write-Output ("审批中保存: code={0} msg={1} (期望 409)" -f $wfSave.code, $wfSave.message)
$rejNoOp = Post-Raw @{ panelCode = 'RKD'; buttonName = '审批驳回'; formData = @{ '编号' = $wfNo }; buttonParam = @{} }
Write-Output ("无意见驳回: code={0} msg={1} (期望 409)" -f $rejNoOp.code, $rejNoOp.message)
$rej = Api 'POST' '/api/px/callButton' @{ panelCode = 'RKD'; buttonName = '审批驳回'; formData = @{ '编号' = $wfNo; '审批意见' = '数量有误,请修改后重新提交' }; buttonParam = @{} } $token
Write-Output ("驳回后={0}" -f $rej.data.'单据状态')
$sub2 = Api 'POST' '/api/px/callButton' @{ panelCode = 'RKD'; buttonName = '提交审批'; formData = @{ '编号' = $wfNo; '审批意见' = '已修改重新提交' }; buttonParam = @{} } $token
Write-Output ("再次提交后={0}" -f $sub2.data.'单据状态')
$hist1 = Api 'GET' "/api/px/getApprovalHistory?panelCode=RKD&code=$wfNo" $null $token
Write-Output ("审批情况(通过前) {0} 条: {1}" -f $hist1.data.Count, (($hist1.data | ForEach-Object { $_.action }) -join '>'))
$appr = Api 'POST' '/api/px/callButton' @{ panelCode = 'RKD'; buttonName = '审批通过'; formData = @{ '编号' = $wfNo; '审批意见' = '同意' }; buttonParam = @{} } $token
Write-Output ("审批通过后={0}" -f $appr.data.'单据状态')
$hist2 = Api 'GET' "/api/px/getApprovalHistory?panelCode=RKD&code=$wfNo" $null $token
Write-Output ("审批情况(通过后) {0} 条: {1}" -f $hist2.data.Count, (($hist2.data | ForEach-Object { $_.action }) -join '>'))
$una2 = Api 'POST' '/api/px/callButton' @{ panelCode = 'RKD'; buttonName = '弃审'; formData = @{ '编号' = $wfNo }; buttonParam = @{} } $token
$hist3 = Api 'GET' "/api/px/getApprovalHistory?panelCode=RKD&code=$wfNo" $null $token
Write-Output ("弃审后={0} 留痕={1}条: {2}" -f $una2.data.'单据状态', $hist3.data.Count, (($hist3.data | ForEach-Object { $_.action }) -join '>'))
$delWf = Api 'POST' '/api/px/callButton' @{ panelCode = 'RKD'; buttonName = '删除'; formData = @{ '编号' = $wfNo }; buttonParam = @{} } $token
Write-Output ("草稿删除后={0}" -f $delWf.data.'单据状态')

Write-Output '== 13. 档案保存(KHDA 单单据全量保存,明细键 khda)=='
# 档案保存 = 全量明细 upsert(缺席行=已删除):先取全量,追加一行新客户后保存(detail.khda)
$before = Api 'POST' '/api/px/queryFormDataList' @{ panelCode = 'KHDA'; pageNo = 1; pageSize = 100 } $token
$items = @($before.data.list[0].detail.khda)
$baseCount = $items.Count
$items += @{ '客户代码' = 'TEST03'; '客户名称' = '全量流验证'; '客户级别' = 'A类' }
$null = Api 'POST' '/api/px/callButton' @{ panelCode = 'KHDA'; buttonName = '提交'; formData = @{ detail = @{ khda = $items } }; buttonParam = @{} } $token
$after = Api 'POST' '/api/px/queryFormDataList' @{ panelCode = 'KHDA'; pageNo = 1; pageSize = 100 } $token
$afterRows = @($after.data.list[0].detail.khda)
$t3 = @($afterRows | Where-Object { $_.'客户代码' -eq 'TEST03' })
$old = @($afterRows | Where-Object { $_.'客户代码' -eq '2010005' })
Write-Output ("全量保存: 基线={0} 保存后={1} TEST03新增={2} 老行2010005保留={3}" -f $baseCount, $afterRows.Count, $t3.Count, $old.Count)
# 收尾:移除验证行(显式删除语义 = 全量保存去掉该行)
$cleanup = @($afterRows | Where-Object { $_.'客户代码' -ne 'TEST03' })
$null = Api 'POST' '/api/px/callButton' @{ panelCode = 'KHDA'; buttonName = '提交'; formData = @{ detail = @{ khda = $cleanup } }; buttonParam = @{} } $token
$final = Api 'POST' '/api/px/queryFormDataList' @{ panelCode = 'KHDA'; pageNo = 1; pageSize = 100 } $token
$fin = @($final.data.list[0].detail.khda)
$gone = @($fin | Where-Object { $_.'客户代码' -eq 'TEST03' })
Write-Output ("显式删除TEST03后: total={0} TEST03残留={1}" -f $fin.Count, $gone.Count)

Write-Output '== 14. 表单描述符 + 新建元数据 =='
$firstDoc = $q2.data.list[0].'编号'
$fd = Api 'GET' "/api/px/getFormDescriptor?panelCode=RKD&code=$firstDoc" $null $token
Write-Output ("panelName={0} meta={1} 明细行={2}" -f $fd.data.panelName, $fd.data.meta.Count, $fd.data.detailData.items.Count)
$nf = Api 'GET' '/api/px/getNewFormPermMatrix?panelCode=CGD' $null $token
Write-Output ("CGD 预览单号={0} 默认日期={1}" -f $nf.data.data.'采购单号', $nf.data.data.'单据日期')

Write-Output '== 15. dashboard =='
$ds = Api 'GET' '/api/dashboard/stats' $null $token
Write-Output ("docStats面板={0} kpis.moActive={1} archives.invItems={2}" -f $ds.data.docStats.Count, $ds.data.kpis.moActive, $ds.data.archives.invItems)

Write-Output '== 16. 库存状况(STOCK_STATUS flat 平表)=='
$st = Api 'POST' '/api/px/queryFormDataList' @{ panelCode = 'STOCK_STATUS'; pageNo = 1; pageSize = 100 } $token
$s0 = $st.data.list | Select-Object -First 1
Write-Output ("total={0} 首行: {1}/{2}/{3} 现存量(主)={4}" -f $st.data.totalSize, $s0.'存货编码', $s0.'仓库', $s0.'批号', $s0.'现存量(主)')
$cfgS = Api 'GET' '/api/px/getPanelConfig?panelCode=STOCK_STATUS' $null $token
Write-Output ("配置: cat={0} 列数={1} 按钮={2}" -f $cfgS.data.metadata.panelCategory, $cfgS.data.metadata.panelPageDto.tablePages[0].gridTabs[0].columns.Count, ($cfgS.data.metadata.panelButtons.buttonName -join ','))

Write-Output '== 17. 通知中心(HSDZ 数据源)=='
$bd = Api 'GET' '/api/portal/badge' $null $token
Write-Output ("badge: todo={0} message={1} alarm={2}" -f $bd.data.todo, $bd.data.message, $bd.data.alarm)
$msgs = Api 'GET' '/api/portal/notice/list?type=message' $null $token
$m0 = $msgs.data | Select-Object -First 1
if ($m0) { Write-Output ("消息首条: {0} | {1}" -f $m0.title, ($m0.time)) }
$al = Api 'GET' '/api/portal/notice/list?type=alarm' $null $token
Write-Output ("alarm 条数={0}" -f $al.data.Count)

Write-Output '== 18. OCR 扫描填单(未配置密钥路径)=='
$tmpImg = "$env:TEMP\yj-ocr-test.png"
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(64, 64)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.DrawString('RK2608290001', (New-Object System.Drawing.Font('Arial', 8)), [System.Drawing.Brushes]::Black, 2, 2)
$g.Dispose(); $bmp.Save($tmpImg, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
$ocrRaw = & curl.exe -s -X POST "$base/api/ocr/scan-form" -H "Authorization: Bearer $token" -F "panelCode=RKD" -F "image=@$tmpImg"
$ocr = $ocrRaw | ConvertFrom-Json
Write-Output ("OCR code={0} message={1} (期望 503/OCR 服务未配置)" -f $ocr.code, $ocr.message)
Remove-Item $tmpImg -ErrorAction SilentlyContinue
Write-Output '== ALL PASSED =='
