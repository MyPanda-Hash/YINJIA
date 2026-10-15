# _v-monthclose-run.ps1 — 月结动作验收(真跑):登录指定账套 → 看状态 → 执行三按钮之一 → 回看结果
#
# ⚠ 两个本机坑(与 _v-stock-detail-api.ps1 同源,别重犯):
#   1) 脚本必须 **UTF-8 with BOM**(Windows PowerShell 5.1 会把无 BOM 的 .ps1 按 GBK 解码 ⇒ 中文按钮名变乱码);
#   2) 请求体带中文(按钮名「上月月结」)一律走 **UTF-8 无 BOM 临时文件 + curl.exe -d "@文件"**;
#      Invoke-RestMethod 的 -Body 会按非 UTF-8 发正文,后端收到乱码按钮名。
#
# 用法(仓库根):
#   powershell -ExecutionPolicy Bypass -File tools\archive\_stock-month-close\_v-monthclose-run.ps1 -Factory YJ_TEST -Action 状态
#   powershell ... -Factory YJ_TEST -Action 上月月结 -Period 2026-09
param(
  [string]$Factory = 'YJ_TEST',
  [ValidateSet('状态', '上月月结', '取消上月月结', '重新月结')][string]$Action = '状态',
  [string]$Period = ''
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://127.0.0.1:8090'
$tmp = $env:TEMP
$utf8 = New-Object System.Text.UTF8Encoding $false

function Post-Json($url, $token, $json) {
  $f = Join-Path $tmp 'yj-mc-body.json'
  [System.IO.File]::WriteAllText($f, $json, $utf8)
  $raw = & curl.exe -s -X POST $url -H "Authorization: Bearer $token" -H 'Content-Type: application/json' -d "@$f"
  Remove-Item $f -ErrorAction SilentlyContinue
  return ($raw | ConvertFrom-Json)
}

$lf = Join-Path $tmp 'yj-mc-login.json'
[System.IO.File]::WriteAllText($lf, ('{"userName":"admin","password":"123456","factory":"' + $Factory + '"}'), $utf8)
$login = (& curl.exe -s -X POST "$base/api/auth/login" -H 'Content-Type: application/json' -d "@$lf") | ConvertFrom-Json
Remove-Item $lf -ErrorAction SilentlyContinue
if ($login.code -ne 200) { throw "登录失败($Factory): $($login | ConvertTo-Json -Compress)" }
$token = $login.data.token
Write-Output ("[账套] {0}({1})·登录 OK" -f $Factory, $login.data.user.factory)

$st = (& curl.exe -s -H "Authorization: Bearer $token" "$base/api/stock/monthClose/status") | ConvertFrom-Json
Write-Output ("[状态] 当前期间 {0} · 建议期间 {1}({2})" -f $st.data.'当前期间', $st.data.'建议期间', $st.data.'建议期间状态')
foreach ($p in $st.data.'未月结期间') { Write-Output ("        未月结: {0}({1} 行入库)" -f $p.'期间', $p.'行数') }
foreach ($c in $st.data.'最近月结') { Write-Output ("        月结过: {0} {1} 单号 {2} 行数 {3} 结存 {4}" -f $c.'期间', $c.'状态', $c.'结转单据编号', $c.'行数', $c.'结存合计') }

if ($Action -eq '状态') { return }

$body = '{"panelCode":"STOCK_DETAIL","buttonName":"' + $Action + '","formData":{},"buttonParam":{' +
        $(if ($Period -ne '') { '"period":"' + $Period + '"' } else { '' }) + '}}'
Write-Output ("[执行] {0} 期间={1}" -f $Action, $(if ($Period -ne '') { $Period } else { '(缺省=上月)' }))
$res = Post-Json "$base/api/px/callButton" $token $body
if ($res.code -ne 200) { throw "动作失败: $($res | ConvertTo-Json -Compress -Depth 6)" }
$d = if ($res.data.'月结') { $res.data.'月结' } else { $res.data }
$d | ConvertTo-Json -Depth 5
