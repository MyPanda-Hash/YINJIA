# _verify-toPicking-perline.ps1 — 转领料单「按工单行」粒度验证(2026-10-09)
# 背景(用户报障):转领料单原先按**工单号**去重合并 ⇒ 同一张工单的多行只能转出一张;
#   口径修正:唯一键 = **工单号 + 工单行号**,每行各转各的。
# 覆盖:① 工单级未审核领料单守卫(存量兜底,老行为保留)
#       ② 同一工单多行一次转 → 每行一张(核心回归:第 2/3 行不再被挡)
#       ③ 同一行重复转 → 按行占用链守卫拒绝
#       ④ 落库核对:表头 加工单号 + 工单行号 = plang.pl_no + plang.pl_xc;
#          占用链 source_line_key = 工单号#行id 且 ACTIVE
#       ⑤ 清理(删草稿 + 释放占用链 + 还原被临时挪开的守卫夹具 + 还原 ll_no2)
# ⚠ 只在**测试账套 HSDZ_MES_TEST** 造数(登录 factory=YJ_TEST);正式库不碰。
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File tools\archive\_verify-toPicking-perline.ps1
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8090'
$java = 'C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe'
if (-not (Test-Path $java)) { $java = (Get-Command java).Source }
$jar = 'D:\workspace\yinjia\tools\lib\mssql-jdbc.jar'
$runner = 'D:\workspace\yinjia\tools\SqlRunner.java'
$testUrl = 'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true'

function Sql([string]$sql) {
  $tmp = Join-Path $PSScriptRoot '_tmp-perline.sql'
  Set-Content -Path $tmp -Value $sql -Encoding UTF8
  $pass = if ($env:YINJIA_SQL_PASS) { $env:YINJIA_SQL_PASS } else { 'Yinjia@2026' }
  $out = & $java '-Dstdout.encoding=UTF-8' -cp $jar $runner $testUrl yinjia $pass $tmp 2>&1
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  return ($out -join "`n")
}

function Post($path, $body, $tok) {
  $headers = @{}
  if ($tok) { $headers['Authorization'] = "Bearer $tok" }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 8))
  try {
    $resp = Invoke-WebRequest -Method Post -Uri "$base$path" -Headers $headers `
      -ContentType 'application/json; charset=utf-8' -Body $bytes -UseBasicParsing
    $text = [System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
  } catch {
    $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream(), [System.Text.Encoding]::UTF8)
    $text = $sr.ReadToEnd()
  }
  return ($text | ConvertFrom-Json)
}

# 勾选载荷 = **数组**(单元素数组经函数返回会被 PS 拆包 ⇒ 用 , @() 保住)
function Payload($rows) {
  $arr = @()
  foreach ($r in $rows) {
    $arr += @{ '公司代码' = $r.'公司代码'; '工单号' = $r.'工单号'; '行id' = $r.'行id'; '工单行号' = $r.'工单行号'; '批次号' = $r.'批次号' }
  }
  return , $arr
}

# 「工单级未审核领料单」= 与 WorkOrderPickingService 同一判据(排除已作废/已审核)
function BlockingSql([string]$no) {
  return @"
SELECT h.单据编号 FROM bd_material_out h
 WHERE h.加工单号 = N'$no' AND ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(h.工单行号,0) = 0
   AND NOT EXISTS (SELECT 1 FROM yj_doc_status c WHERE c.panel_code='MATERIAL_OUT' AND c.doc_no=h.单据编号 AND ISNULL(c.canceled,'N')='Y')
   AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='MATERIAL_OUT' AND s.doc_no=h.单据编号 AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y');
"@
}

$login = Post '/api/auth/login' @{ userName = 'admin'; password = '123456'; factory = 'YJ_TEST' } $null
if ($login.code -ne 200) { throw "登录失败: $($login.message)" }
$tok = $login.data.token
Write-Output "① 登录测试账套(factory=$($login.data.user.factory)) OK"

$list = Post '/api/px/workOrderList' @{ '日期从' = '2026-08-01'; '日期到' = '2026-12-31' } $tok
$rows = @($list.data)
Write-Output "② 工单行数 = $($rows.Count)"

# 取"工单级未审核领料单"单号(SqlRunner 输出是 `  | CL-x |` 形式,用正则抓号,别按行头匹配)
function BlockingDocs([string]$no) {
  $out = Sql (BlockingSql $no)
  return @([regex]::Matches($out, '(?:CL|LL)[0-9][0-9\-]*') | ForEach-Object { $_.Value } | Sort-Object -Unique)
}

$groups = $rows | Where-Object { $_.'结案' -ne 'Y' -and [double]$_.'排产数量' -gt 0 } | Group-Object { $_.'工单号' } | Where-Object { $_.Count -ge 2 }
if (-not $groups) { throw '测试库找不到「同单号 ≥2 行 + 未结案 + 排产>0」的工单' }
# 优先挑**带工单级未审核领料单夹具**的工单(用例① 也跑得到)+ **批次场景**(同单多行共用同一行号),
# 后者最能证伪"按工单号合并"的旧口径。
$cand = $null; $best = -1; $preBlocking = @()
foreach ($g in $groups) {
  $b = @(BlockingDocs $g.Name)
  $xcs = @($g.Group | ForEach-Object { [string]$_.'工单行号' })
  $dupXc = ($xcs | Group-Object | Where-Object { $_.Count -gt 1 }).Count -gt 0
  $score = 0
  if ($b.Count) { $score += 2 }
  if ($dupXc) { $score += 1 }
  if ($score -gt $best) { $best = $score; $cand = $g; $preBlocking = $b }
}
$picked = @($cand.Group | Select-Object -First 3)
$no = $cand.Name
Write-Output ("③ 选中工单 {0}(共 {1} 行,取 {2} 行): 行号=[{3}] 行id=[{4}] 批次=[{5}] 工单级夹具=[{6}]" -f `
    $no, $cand.Count, $picked.Count,
    (($picked | ForEach-Object { $_.'工单行号' }) -join ','),
    (($picked | ForEach-Object { $_.'行id' }) -join ','),
    (($picked | ForEach-Object { $_.'批次号' }) -join ','),
    ($preBlocking -join ','))

# ---- 用例①:工单级未审核领料单守卫(存量兜底)----
$blocking = $preBlocking
if ($blocking.Count) {
  $r0 = Post '/api/px/workOrderList/toPicking' @{ rows = (Payload @($picked[0])) } $tok
  Write-Output "④ 工单级存量守卫: code=$($r0.code) msg=$($r0.message)"
  if ($r0.code -eq 200) { throw '[FAIL] 工单级未审核领料单未挡住(存量兜底失效)' }
  Write-Output "   [PASS] 工单级单据挡住整单(夹具 $($blocking -join ','))"
  # 临时挪开夹具(便于验按行逻辑),跑完原样还原
  $inList = ($blocking | ForEach-Object { "N'$_'" }) -join ','
  Sql "UPDATE bd_material_out SET asp_cancel='Y' WHERE 单据编号 IN ($inList);" | Out-Null
  Write-Output "   (临时作废夹具 $($blocking -join ',') 以便验按行逻辑,末尾还原)"
} else {
  Write-Output "④ 工单级存量守卫: 该工单无工单级夹具,跳过"
}

# 记录 plang 原 ll_no2(跑完还原)
$orig = Sql "SELECT id, ISNULL(ll_no2,N'') AS ll FROM plang WHERE pl_no = N'$no' ORDER BY id;"

# ---- 用例②:多行一次转 → 每行一张(核心回归)----
$r1 = Post '/api/px/workOrderList/toPicking' @{ rows = (Payload $picked) } $tok
Write-Output "⑤ 同单多行一次转: code=$($r1.code) 张数=$($r1.data.'转领料单张数')"
Write-Output "   清单 = $($r1.data.'单号清单' -join ' | ')"
Write-Output "   失败 = $($r1.data.'失败行' -join '; ')"
if ($r1.code -ne 200) { throw "转领料失败: $($r1.message)" }
$expect = $picked.Count
$got = [int]$r1.data.'转领料单张数'
if ($got -ne $expect) { throw "[FAIL] 期望 $expect 张(按行),实得 $got 张 —— 仍是按工单号合并" }
Write-Output "   [PASS] 同单多行各转一张($got/$expect)"

# ---- 用例③:同一行重复转 → 按行守卫拒绝 ----
$r2 = Post '/api/px/workOrderList/toPicking' @{ rows = (Payload @($picked[0])) } $tok
Write-Output "⑥ 同一行重复转守卫: code=$($r2.code) msg=$($r2.message)"
if ($r2.code -eq 200) { throw '[FAIL] 同一行重复转竟然成功(占用链未按行生效)' }
Write-Output "   [PASS] 重复转被拒"

# ---- 用例④:落库核对 ----
$newNos = @($r1.data.'单号清单' | ForEach-Object { ($_ -split '→')[1] }) -join "','"
$chk = Sql @"
SELECT 单据编号, 加工单号, 工单行号, 来源单号, 业务类型, 出库类别, 备注 FROM bd_material_out WHERE 单据编号 IN ('$newNos') ORDER BY 单据编号;
SELECT source_line_key, target_form_no, link_status FROM form_flow_link WHERE source_panel_code='PLANG' AND target_panel_code='MATERIAL_OUT' AND target_form_no IN ('$newNos') ORDER BY source_line_key;
"@
Write-Output "⑦ 落库核对:"
Write-Output $chk
foreach ($p in $picked) {
  $rowId = [string]$p.'行id'
  if ($chk -notmatch [regex]::Escape("$no#$rowId")) { throw "[FAIL] 占用链缺 源行键 $no#$rowId(未按行落)" }
}
Write-Output "   [PASS] 占用链按行(source_line_key = 工单号#行id)"

# ---- 用例⑤:清理 ----
# 占用链直接删掉(不是置 RELEASED):草稿本身要删,留着指向已不存在单据的 RELEASED 行只是探针残渣
# (正式链路上「删下游草稿」是收尾=RELEASED 留痕,那是业务行为;探针要的是跑完不留痕)。
$clean = Sql @"
DELETE FROM form_flow_link
 WHERE source_panel_code='PLANG' AND target_panel_code='MATERIAL_OUT' AND target_form_no IN ('$newNos');
DELETE FROM bl_material_out WHERE 单据编号 IN ('$newNos');
DELETE FROM bd_material_out WHERE 单据编号 IN ('$newNos');
DELETE FROM yj_doc_status WHERE panel_code='MATERIAL_OUT' AND doc_no IN ('$newNos');
"@
Write-Output "⑧ 清理新造草稿:"
Write-Output $clean
# 还原 plang.ll_no2
foreach ($line in ($orig -split "`n" | Where-Object { $_ -match '^\s*\d+\s*\|' })) {
  $parts = $line.Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim() }
  $lid = $parts[0]; $ll = if ($parts.Count -gt 1) { $parts[1] } else { '' }
  $val = if ([string]::IsNullOrWhiteSpace($ll)) { 'NULL' } else { "N'$ll'" }
  Sql "UPDATE plang SET ll_no2 = $val WHERE id = $lid;" | Out-Null
}
# 还原被临时挪开的守卫夹具
if ($blocking.Count) {
  $inList = ($blocking | ForEach-Object { "N'$_'" }) -join ','
  Sql "UPDATE bd_material_out SET asp_cancel='N' WHERE 单据编号 IN ($inList);" | Out-Null
  Write-Output "   夹具已还原:$($blocking -join ',')"
}
Write-Output '完成。'
