. (Join-Path $PSScriptRoot 'common.ps1')
$token = Connect-YjTest
$id = (Get-Content 'evidence-pick.json' -Raw -Encoding UTF8 | ConvertFrom-Json).组装id
if (-not $id) { $id = 840 }
$doc = Api 'GET' ("/api/px/mobilePick/doc?id=" + $id) $null $token
$items = Arr $doc.Data '领料明细'
foreach ($it in $items) {
  Write-Host '--- 行 ---'
  $it.PSObject.Properties | ForEach-Object { Write-Host ("   {0} = {1}" -f $_.Name, $_.Value) }
}
