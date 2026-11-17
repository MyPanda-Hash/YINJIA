# _probe-print-payload.ps1 — 复现:生单(打印=true)时,组装/混料两张单各自的打印载荷长什么样
. (Join-Path $PSScriptRoot 'common.ps1')
$token = Connect-YjTest
$body = J @{ woNo = 'GD-2026-11-0010'; line = 3 }
$r = Api 'POST' '/api/px/mobilePick/generate' $body $token
Write-Host ("code=" + $r.Code + " " + $r.Message)
$top = V $r.Data '打印'
Write-Host ("顶层 打印(前端现在只打这个): 标题=" + (V $top '标题') + " 领料类型=" + (V $top '领料类型') + " 单号=" + (V $top '领料单号') + " 明细=" + (Arr $top '明细').Count)
$docs = Arr $r.Data '单据'
Write-Host ("单据数=" + $docs.Count)
for ($i = 0; $i -lt $docs.Count; $i++) {
  $d = $docs[$i]
  $p = V $d '打印'
  Write-Host ("  单据[$i] 领料类型=" + (V $d '领料类型') + " 单号=" + (V $d '领料单号') + " 有打印载荷=" + ($null -ne $p) + " 标题=" + (V $p '标题') + " 明细=" + (Arr $p '明细').Count)
}
Write-Json $r.Data 'evidence-generate-print.json' | Out-Null
