. (Join-Path $PSScriptRoot '..\_scan-e2e-20261118\common.ps1')
$token = Connect-YjTest
$k = [uri]::EscapeDataString('混料')
$r = Api 'GET' ("/api/px/mobilePick/locate?woNo=GD-2026-11-0010&line=3&kind=" + $k) $null $token
Write-Host ("code=" + $r.Code)
Write-Host $r.Raw
