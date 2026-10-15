# _v-stock-detail-api.ps1 — 一次性验收:库存明细面板(STOCK_DETAIL)在跑着的后端上真的能出数
#   ① 面板配置能取(flat → kucun;8 个明细列、3 个查询区字段)
#   ② 取数能出(本页行 + totalSize)
#   ③ 参照绑定:存货编码/仓库 声明为参照 ⇒ 过滤走「编码精确等值」(用真实编码查一次核对行数)
#
# ⚠ 两个本机坑(2026-10-15 踩到,别重犯):
#   1) 脚本必须存成 **UTF-8 with BOM**:Windows PowerShell 5.1 对无 BOM 的 .ps1 按 ANSI(GBK)解码,
#      中文条件键会变乱码;本仓库其它 ps1 探针同样都是带 BOM 的。
#   2) 请求体**不能**用 Invoke-RestMethod 的 -Body 传中文:PS 5.1 默认按非 UTF-8 编码发正文 ⇒
#      条件键到后端已是乱码、过滤静默失效(实测 totalSize 不随条件变化)。一律沿用本仓库探针的做法:
#      写 UTF-8(无 BOM)临时文件 + `curl.exe -d "@文件"` 原样发字节。
# 用法(仓库根):powershell -ExecutionPolicy Bypass -File tools\archive\_kucun-stock-detail\_v-stock-detail-api.ps1
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://127.0.0.1:8090'
$panel = 'STOCK_DETAIL'
$tmp = $env:TEMP
$utf8 = New-Object System.Text.UTF8Encoding $false

function Post-Json($url, $token, $json) {
  $f = Join-Path $tmp 'yj-sd-body.json'
  [System.IO.File]::WriteAllText($f, $json, $utf8)
  $raw = & curl.exe -s -X POST $url -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "@$f"
  Remove-Item $f -ErrorAction SilentlyContinue
  return ($raw | ConvertFrom-Json)
}
function Write-Row($row) {
  $parts = @()
  foreach ($p in $row.PSObject.Properties) { $parts += ('{0}={1}' -f $p.Name, $p.Value) }
  Write-Output ('   ' + ($parts -join ' | '))
}

$lf = Join-Path $tmp 'yj-sd-login.json'
[System.IO.File]::WriteAllText($lf, '{"userName":"admin","password":"123456"}', $utf8)
$login = (& curl.exe -s -X POST "$base/api/auth/login" -H 'Content-Type: application/json' -d "@$lf") | ConvertFrom-Json
Remove-Item $lf -ErrorAction SilentlyContinue
if ($login.code -ne 200) { throw "登录失败: $($login | ConvertTo-Json -Compress)" }
$token = $login.data.token
Write-Output '1) 登录 OK'

$cfg = (& curl.exe -s -H "Authorization: Bearer $token" "$base/api/px/getPanelConfig?panelCode=$panel") | ConvertFrom-Json
if ($cfg.code -ne 200) { throw "取面板配置失败: $($cfg | ConvertTo-Json -Compress)" }
$tp = $cfg.data.metadata.panelPageDto.tablePages[0]
Write-Output ('2) 面板配置 OK:panelName={0} pageSize={1}' -f $cfg.data.metadata.panelName, $tp.pageSize)
Write-Output ('   明细列: ' + ((@($tp.gridTabs[0].columns)) -join ', '))
Write-Output ('   查询区: ' + (((@($tp.queryFields)) | ForEach-Object { $_.dataName }) -join ', '))

$r = Post-Json "$base/api/px/queryFormDataList" $token ('{"panelCode":"' + $panel + '","pageNo":1,"pageSize":5}')
Write-Output ('3) 取数 OK:totalSize={0} 本页 {1} 行' -f $r.data.totalSize, @($r.data.list).Count)
$r.data.list | Select-Object -First 2 | ForEach-Object { Write-Row $_ }

Write-Output '4) 编码精确过滤(存货编码=HP-08;kucun 里 3 行 —— 编码互为子串时 LIKE 会串行):'
$c = Post-Json "$base/api/px/queryFormDataList" $token ('{"panelCode":"' + $panel + '","pageNo":1,"pageSize":50,"condition":{"存货编码":"HP-08"}}')
Write-Output ('   totalSize={0}' -f $c.data.totalSize)
$c.data.list | Select-Object -First 2 | ForEach-Object { Write-Row $_ }

Write-Output '5) 仓库精确过滤(仓库=YCL-01):'
$w = Post-Json "$base/api/px/queryFormDataList" $token ('{"panelCode":"' + $panel + '","pageNo":1,"pageSize":3,"condition":{"仓库":"YCL-01"}}')
Write-Output ('   totalSize={0}' -f $w.data.totalSize)
$w.data.list | Select-Object -First 2 | ForEach-Object { Write-Row $_ }

Write-Output '6) 批号过滤(批号=SX-20261014):'
$b = Post-Json "$base/api/px/queryFormDataList" $token ('{"panelCode":"' + $panel + '","pageNo":1,"pageSize":3,"condition":{"批号":"SX-20261014"}}')
Write-Output ('   totalSize={0}' -f $b.data.totalSize)
$b.data.list | Select-Object -First 2 | ForEach-Object { Write-Row $_ }
