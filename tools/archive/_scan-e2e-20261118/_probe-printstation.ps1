. (Join-Path $PSScriptRoot 'common.ps1')
$token = Connect-YjTest
$st = Api 'GET' '/api/px/print/station' $null $token
Write-Host ("code=" + $st.Code + " " + $st.Message)
if ($st.Data) { $st.Data | ConvertTo-Json -Depth 6 }
