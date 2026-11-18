. (Join-Path $PSScriptRoot '..\_scan-e2e-20261118\common.ps1')
$token = Connect-YjTest
# 造一对组装+混料单(关掉打印,别出纸)
$b = J @{ items = @(@{ woNo = 'GD-2026-11-0007'; line = 4 }); 打印 = $false }
$g = Api 'POST' '/api/px/mobilePick/create/batch' $b $token
Write-Host ("生成 code=" + $g.Code + " 成功数=" + (V $g.Data '成功数'))
$docs = @(V (Arr $g.Data '成功')[0] '单据')
foreach ($d in $docs) { Write-Host ("  " + (V $d '领料类型') + " " + (V $d '领料单号') + " id=" + (V $d 'id')) }
# 逐种参数验证 locate
function Try-Locate($label, $qs) {
  $r = Api 'GET' ("/api/px/mobilePick/locate?woNo=GD-2026-11-0007&line=4" + $qs) $null $token
  $id = V $r.Data 'id'; $k = V $r.Data '领料类型'; $hint = V $r.Data 'hint'; $found = V $r.Data 'found'
  Write-Host ("[{0}] found={1} id={2} 类型={3} hint={4}" -f $label, $found, $id, $k, $hint)
}
Try-Locate '不带 kind(老行为)' ''
Try-Locate 'kind=组装' '&kind=组装'
Try-Locate 'kind=混料' '&kind=混料'
Try-Locate 'kind=A' '&kind=A'
Try-Locate 'kind=M' '&kind=M'
Try-Locate 'kind=X(认不出)' '&kind=X'
# 没有混料单的工单:kind=混料 应给 no-doc-kind
$r2 = Api 'GET' '/api/px/mobilePick/locate?woNo=GD-2026-11-0010&line=3&kind=混料' $null $token
Write-Host ("[无混料单的工单 kind=混料] found=" + (V $r2.Data 'found') + " hint=" + (V $r2.Data 'hint'))
