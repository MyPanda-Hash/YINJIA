. (Join-Path $PSScriptRoot 'common.ps1')
$token = Connect-YjTest
$ev = Get-Content 'evidence-other.json' -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Host ("其他出库单=" + $ev.其他出库单)
$slip = Api 'POST' '/api/px/slip/rows' (J @{ 面板 = 'OTHER_OUT'; 单据编号 = $ev.其他出库单 }) $token
Write-Host ("code=" + $slip.Code + " msg=" + $slip.Message)
Write-Host "顶层键:"
if ($slip.Data) { $slip.Data.PSObject.Properties | ForEach-Object { $v=$_.Value; $c = if ($v -is [array]) { $v.Count } else { '' }; Write-Host ("   " + $_.Name + " (" + $c + ") = " + $(if ($v -is [array]) { "" } else { $v })) } }
Write-Json $slip.Data 'evidence-slip-rows.json' | Out-Null
