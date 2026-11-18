. (Join-Path $PSScriptRoot '..\_scan-e2e-20261118\common.ps1')
$token = Connect-YjTest
function Try-Locate($label, $kindRaw) {
  $k = [uri]::EscapeDataString($kindRaw)
  $r = Api 'GET' ("/api/px/mobilePick/locate?woNo=GD-2026-11-0007&line=4&kind=" + $k) $null $token
  Write-Host ("[{0}] code={1} found={2} id={3} 类型={4} hint={5}" -f $label, $r.Code, (V $r.Data 'found'), (V $r.Data 'id'), (V $r.Data '领料类型'), (V $r.Data 'hint'))
}
Try-Locate 'kind=组装(URL 编码)' '组装'
Try-Locate 'kind=混料(URL 编码)' '混料'
$k2 = [uri]::EscapeDataString('混料')
$r2 = Api 'GET' ("/api/px/mobilePick/locate?woNo=GD-2026-11-0010&line=3&kind=" + $k2) $null $token
Write-Host ("[无混料单的工单 kind=混料] code=" + $r2.Code + " found=" + (V $r2.Data 'found') + " hint=" + (V $r2.Data 'hint'))
