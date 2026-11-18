# 10-createbatch.ps1 — 手机扫码 ·「生成工单领料/退料单」(扫工单 → 批量生单)
. (Join-Path $PSScriptRoot 'common.ps1')
$token = Connect-YjTest

# ① 工单视角的开单状态(页面上半张表就是它)
$st = Api 'GET' '/api/px/mobilePick/create/woStatus' $null $token
Check '开单工作台·工单状态列表可读' ($st.Code -eq 200) ("code=" + $st.Code)
$rows = Arr $st.Data 'list'
if ($rows.Count -eq 0) { $rows = Arr $st.Data 'rows' }
Check '开单工作台·返回工单行(>0)' ($rows.Count -gt 0) ("行数=" + $rows.Count)
$unopened = @($rows | Where-Object { -not (V $_ '已开单') })
Check '开单工作台·存在未开单工单' ($unopened.Count -gt 0) ("未开单=" + $unopened.Count)

# ② 扫两张工单批量生单(每张预期出「组装+混料」两张)
$body = '{"items":[{"woNo":"GD-2026-11-0010","line":3},{"woNo":"GD-2026-11-0009","line":1}],"打印":false}'
$batch = Api 'POST' '/api/px/mobilePick/create/batch' $body $token
Check '批量生单·接口返回 200' ($batch.Code -eq 200) ("code=" + $batch.Code + ' ' + $batch.Message)
Check '批量生单·成功数 = 2' ((V $batch.Data '成功数') -eq 2) ("成功数=" + (V $batch.Data '成功数') + " 失败数=" + (V $batch.Data '失败数'))
$okRows = @(V $batch.Data '成功')
foreach ($r in $okRows) {
  $docs = @(V $r '单据')
  $kinds = ($docs | ForEach-Object { V $_ '领料类型' }) -join '+'
  Check ("批量生单·" + (V $r '工单号') + "#" + (V $r '工单行号') + " 出两张单") ($docs.Count -eq 2) ("单据=" + $docs.Count + " 类型=" + $kinds)
}
Write-Json $batch.Data 'evidence-create-batch.json' | Out-Null

# ③ 再扫一次同样的单:必须幂等(不重复建单,返回既有单号)
$again = Api 'POST' '/api/px/mobilePick/create/batch' $body $token
$againRows = @(V $again.Data '成功')
$allDup = $true
foreach ($r in $againRows) { foreach ($d in @(V $r '单据')) { if (-not (V $d '重复')) { $allDup = $false } } }
Check '批量生单·重扫不重复建单(重复=true)' ($again.Code -eq 200 -and $allDup) ("code=" + $again.Code + " 重复标记=" + $allDup)

Summary '生成工单领料退料单'
