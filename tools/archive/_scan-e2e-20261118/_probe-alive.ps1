. (Join-Path $PSScriptRoot 'common.ps1')
$token = Connect-YjTest
$loc = Api 'GET' '/api/px/mobilePick/locate?woNo=GD-2026-11-0010&line=3' $null $token
Write-Host ("locate code=" + $loc.Code + " found=" + (V $loc.Data 'found') + " 单据数=" + (Arr $loc.Data '单据').Count)
$mix = Api 'GET' '/api/px/mix/bom?productCode=A-48-16' $null $token
Write-Host ("mix/bom code=" + $mix.Code + " 行数=" + (Arr $mix.Data 'list').Count)
