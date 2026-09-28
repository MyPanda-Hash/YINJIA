# 验证:MATERIAL_OUT 面板配置(字段/按钮) + 转ERP 链路可达性
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://127.0.0.1:8090'

function Api($method, $path, $body, $token) {
  $cargs = @('-s', '-X', $method, "$base$path", '-H', 'Content-Type: application/json')
  if ($token) { $cargs += @('-H', "Authorization: Bearer $token") }
  $tmp = $null
  if ($body) {
    $json = $body | ConvertTo-Json -Depth 10 -Compress
    $tmp = Join-Path $env:TEMP "yj-verify-matout.json"
    [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding $false))
    $cargs += @('-d', "@$tmp")
  }
  try { $raw = & curl.exe @cargs } finally { if ($tmp) { Remove-Item $tmp -ErrorAction SilentlyContinue } }
  return $raw | ConvertFrom-Json
}

$login = Api 'POST' '/api/auth/login' @{ userName = 'admin'; password = '123456' }
$token = $login.data.token
Write-Output "登录 OK isAdmin=$($login.data.user.isAdmin)"

$cfg = Api 'GET' '/api/px/getPanelConfig?panelCode=MATERIAL_OUT' $null $token
$m = $cfg.data.metadata
Write-Output "面板: $($m.panelName) | mode=$($m.mode) | 列数=$($m.panelPageDto.tablePages[0].gridTabs[0].columns.Count)"
Write-Output "按钮组:"
foreach ($g in $m.buttonGroups) { Write-Output ("  [{0}] {1}" -f $g.groupName, (($g.buttons | ForEach-Object { $_.buttonName }) -join ', ')) }

Write-Output "`n== 明细列(常见字段在前)=="
$cols = $m.panelPageDto.tablePages[0].gridTabs[0].columns
foreach ($c in $cols) { Write-Output ("  {0,-28} hidden={1}" -f $c.field, $c.hidden) }

Write-Output "`n== 表头字段 =="
$hf = $m.panelPageDto.tablePages[0].formFields
if (-not $hf) { $hf = $m.panelPageDto.formFields }
foreach ($c in $hf) { Write-Output ("  {0,-28} hidden={1}" -f $c.field, $c.hidden) }

Write-Output "`n== 查询区字段 =="
foreach ($c in $m.panelPageDto.tablePages[0].queryFields) { Write-Output ("  $($c.field)") }
