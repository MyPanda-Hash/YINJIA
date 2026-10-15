# verify-list.ps1 — 修复后:库存报表组列表取数 + 台账弹窗条件(开始/结束日期 + 仓库/存货)回归
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$base = 'http://127.0.0.1:8090'
function PostJson($path, $obj, $token) {
  $tmp = Join-Path $env:TEMP 'yj-post.json'
  [System.IO.File]::WriteAllText($tmp, ($obj | ConvertTo-Json -Depth 8 -Compress), (New-Object System.Text.UTF8Encoding $false))
  $cargs = @('-s', '-X', 'POST', "$base$path", '-H', 'Content-Type: application/json')
  if ($token) { $cargs += @('-H', "Authorization: Bearer $token") }
  $cargs += @('-d', "@$tmp")
  (curl.exe @cargs) | ConvertFrom-Json
}
$login = PostJson '/api/auth/login' @{ userName = 'admin'; password = '123456' } $null
$token = $login.data.token
foreach ($p in @('STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_SUMMARY', 'STOCK_DETAIL')) {
  $q = PostJson '/api/px/queryFormDataList' @{ panelCode = $p; pageNo = 1; pageSize = 5 } $token
  $keys = if ($q.data.list.Count) { ($q.data.list[0].PSObject.Properties.Name -join ',') } else { '(空)' }
  "$p : totalSize=$($q.data.totalSize) 返回行=$($q.data.list.Count)"
  "    首行键: $keys"
}
# 台账弹窗:仓库/存货/日期段(前端 rqdRange 口径)
$wh = (PostJson '/api/px/queryFormDataList' @{ panelCode = 'STOCK_LEDGER'; pageNo = 1; pageSize = 200 } $token).data.list |
      Where-Object { $_.'仓库编码' } | Select-Object -First 1
$code = $wh.'仓库编码'; $item = $wh.'存货编码'
"台账样本: 仓库编码=$code 存货编码=$item"
$cond = @{ panelCode = 'STOCK_LEDGER'; pageNo = 1; pageSize = 50
           condition = @{ '仓库' = $code; '存货' = $item; '开始日期' = '2000-01-01'; '结束日期' = '2030-12-31' } }
$q2 = PostJson '/api/px/queryFormDataList' $cond $token
"台账弹窗条件查询: totalSize=$($q2.data.totalSize)(应含期初/期末两合成行) 返回=$($q2.data.list.Count) 首行单据类型=$($q2.data.list[0].'单据类型') 末行=$($q2.data.list[-1].'单据类型')"
# 收发存汇总:期次区间
$q3 = PostJson '/api/px/queryFormDataList' @{ panelCode = 'STOCK_SUMMARY'; pageNo = 1; pageSize = 5
    condition = @{ '开始日期' = '2000-01'; '结束日期' = '2030-12' } } $token
"收发存汇总期次区间: totalSize=$($q3.data.totalSize)"
