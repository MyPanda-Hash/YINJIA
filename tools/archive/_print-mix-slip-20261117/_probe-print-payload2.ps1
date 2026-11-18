. (Join-Path $PSScriptRoot 'common.ps1')
$token = Connect-YjTest
$body = J @{ woNo = 'GD-2026-11-0009'; line = 1 }
$r = Api 'POST' '/api/px/mobilePick/generate' $body $token
Write-Host ("code=" + $r.Code + " " + $r.Message + " 重复=" + (V $r.Data '重复'))
$top = V $r.Data '打印'
Write-Host ("顶层打印: 标题=" + (V $top '标题') + " 类型=" + (V $top '领料类型') + " 明细=" + (Arr $top '明细').Count)
foreach ($d in (Arr $r.Data '单据')) {
  $p = V $d '打印'
  Write-Host ("  单据: 类型=" + (V $d '领料类型') + " 单号=" + (V $d '领料单号') + " 有载荷=" + ($null -ne $p) + " 标题=" + (V $p '标题') + " 明细=" + (Arr $p '明细').Count)
}
Write-Json $r.Data 'evidence-generate-print-fresh.json' | Out-Null
