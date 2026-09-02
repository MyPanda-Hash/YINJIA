# audit-conditions.ps1 — 带筛选条件(condition)的查询冒烟:暴露 condition 字段映射/SQL 分支错误
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:8090'

function ApiRaw($method, $path, $body, $token) {
  $cargs = @('-s', '-X', $method, "$base$path", '-H', 'Content-Type: application/json')
  if ($token) { $cargs += @('-H', "Authorization: Bearer $token") }
  $tmp = $null
  if ($body) {
    $json = $body | ConvertTo-Json -Depth 10 -Compress
    $tmp = Join-Path $env:TEMP 'yj-cond-body.json'
    [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding $false))
    $cargs += @('-d', "@$tmp")
  }
  try { return (& curl.exe @cargs) } finally { if ($tmp) { Remove-Item $tmp -ErrorAction SilentlyContinue } }
}

$login = ApiRaw 'POST' '/api/auth/login' @{ userName = 'admin'; password = '123456' } $null | ConvertFrom-Json
$token = $login.data.token

# 各面板的 condition 键用其查询字段标签(参照字段/编号/日期/状态等,取每个面板前 3 个 query 字段)
$cases = @(
  @{ p = 'SO_ORDER'; c = @{ '单据编号' = 'SO-NOT-EXIST'; '客户' = '测试' } },
  @{ p = 'MANU_ORDER'; c = @{ '单据编号' = 'MO-NOT-EXIST'; '生产车间' = '测试' } },
  @{ p = 'PU_ORDER'; c = @{ '单据编号' = 'PO-NOT-EXIST'; '供应商' = '测试' } },
  @{ p = 'DEPT'; c = @{ '部门编码' = 'ZZZ' } },
  @{ p = 'KHDA'; c = @{ '客户代码' = 'ZZZ' } },
  @{ p = 'RD_FILTER_EFF'; c = @{ '记录编号' = 'ZZZ' } },
  @{ p = 'DISPATCH'; c = @{ '单据编号' = 'ZZZ' } },
  @{ p = 'INV'; c = @{ '存货编码' = 'ZZZ' } }
)

$fail = New-Object System.Collections.ArrayList
foreach ($case in $cases) {
  $raw = ApiRaw 'POST' '/api/px/queryFormDataList' @{ panelCode = $case.p; pageNo = 1; pageSize = 5; condition = $case.c } $token
  try {
    $j = $raw | ConvertFrom-Json
    if ($j.code -ne 200) { [void]$fail.Add("$($case.p) => code=$($j.code) $($j.message)") }
    else { Write-Output "OK  $($case.p) (rows=$(@($j.data.list).Count))" }
  } catch { [void]$fail.Add("$($case.p) => RAW: $raw") }
}
Write-Output "== condition 查询: ok=$($cases.Count - $fail.Count) fail=$($fail.Count) =="
foreach ($f in $fail) { Write-Output "  FAIL $f" }
