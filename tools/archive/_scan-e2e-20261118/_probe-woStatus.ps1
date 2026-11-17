# _probe-woStatus.ps1 — 只看开单工作台「工单状态」接口返回的形状与条数(排查列表是否被截断)
. (Join-Path $PSScriptRoot 'common.ps1')
$token = Connect-YjTest
$st = Api 'GET' '/api/px/mobilePick/create/woStatus' $null $token
Write-Host ("code=" + $st.Code)
if ($st.Data) {
  $st.Data.PSObject.Properties | ForEach-Object {
    $v = $_.Value
    $t = if ($null -eq $v) { 'null' } else { $v.GetType().Name }
    $c = if ($v -is [array]) { $v.Count } else { '' }
    Write-Host ("  {0} : {1} (count={2})" -f $_.Name, $t, $c)
  }
  Write-Json $st.Data 'evidence-woStatus.json' | Out-Null
  $rows = Arr $st.Data 'list'
  Write-Host ("工单行数=" + $rows.Count)
  if ($rows.Count -gt 0) {
    Write-Host '第一行键:'
    $rows[0].PSObject.Properties | ForEach-Object { Write-Host ("   " + $_.Name + " = " + $_.Value) }
    $unopened = @($rows | Where-Object { -not (V $_ '已开单') })
    Write-Host ("未开单行数=" + $unopened.Count)
  }
}
