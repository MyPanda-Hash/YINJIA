. (Join-Path $PSScriptRoot 'common.ps1')
$token = Connect-YjTest
$ev = Get-Content 'evidence-other.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$slip = Api 'POST' '/api/px/slip/rows' (J @{ 面板 = 'OTHER_OUT'; 单据编号 = [string]$ev.其他出库单 }) $token
$v = V $slip.Data '明细'
Write-Host ("V null? " + ($null -eq $v) + "  type=" + $(if ($null -ne $v) { $v.GetType().FullName } else { 'n/a' }))
$rows = Arr $slip.Data '明细'
Write-Host ("Arr null? " + ($null -eq $rows) + "  count=" + $rows.Count)
Write-Host ("data keys=" + (($slip.Data.PSObject.Properties | ForEach-Object { $_.Name }) -join ','))
