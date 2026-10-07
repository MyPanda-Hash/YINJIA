# _verify-toPicking.ps1 — 转领料单端到端验证(2026-10-07)
# 背景:生产工单页「打印领料单」改成「转领料单」(生成材料出库单草稿)。
# 口径:只在**测试账套 YJ_TEST(HSDZ_MES_TEST)**上造单,不污染正式库;正式库仅只读核对。
# 用法: pwsh -File tools\archive\_verify-toPicking.ps1
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8090'

function Post($path, $body, $tok) {
  $headers = @{}
  if ($tok) { $headers['Authorization'] = "Bearer $tok" }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 8))
  try {
    $resp = Invoke-WebRequest -Method Post -Uri "$base$path" -Headers $headers `
      -ContentType 'application/json; charset=utf-8' -Body $bytes -UseBasicParsing
    $text = [System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
  } catch {
    # 业务守卫命中时后端返 400/409 —— 这里要把响应体读出来看 message(PowerShell 5.1 无 -SkipHttpErrorCheck)
    $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream(), [System.Text.Encoding]::UTF8)
    $text = $sr.ReadToEnd()
  }
  $script:lastRaw = $text
  return ($text | ConvertFrom-Json)
}
# 上一次调用的原始响应体(排障用)
$script:lastRaw = ''

$login = Post '/api/auth/login' @{ userName = 'admin'; password = '123456'; factory = 'YJ_TEST' } $null
if ($login.code -ne 200) { throw "登录失败: $($login.message)" }
$tok = $login.data.token
Write-Output "① 登录(测试账套 factory=$($login.data.user.factory)) OK"

$list = Post '/api/px/workOrderList' @{ '日期从' = '2026-08-01'; '日期到' = '2026-10-31' } $tok
$rows = @($list.data)
Write-Output "② 工单行数 = $($rows.Count)"

$closed = $rows | Where-Object { $_.'结案' -eq 'Y' } | Select-Object -First 1
$zero   = $rows | Where-Object { $_.'结案' -ne 'Y' -and [double]$_.'排产数量' -le 0 } | Select-Object -First 1
$good   = $rows | Where-Object { $_.'结案' -ne 'Y' -and [double]$_.'排产数量' -gt 0 -and [string]::IsNullOrWhiteSpace($_.'领料单号') } | Select-Object -First 1
if (-not $good) { throw '测试库里没有可转领料的工单(未结案 + 排产数量>0 + 无领料单号)' }

# 勾选行载荷必须是**数组**:单元素数组经函数返回会被 PowerShell 拆包成对象,后端 castRows 只认 List
# ⇒ 用 `return , @(...)` 保住数组,否则接口收到的是对象、rows 判空。
function PickPayload($r) {
  $one = @{ '公司代码' = $r.'公司代码'; '工单号' = $r.'工单号'; '工单行号' = $r.'工单行号'; '批次号' = $r.'批次号' }
  return , @($one)
}

if ($closed) {
  $r = Post '/api/px/workOrderList/toPicking' @{ rows = (PickPayload $closed) } $tok
  Write-Output "③ 已结案守卫 [$($closed.'工单号')]: code=$($r.code) msg=$($r.message)"
}
if ($zero) {
  $r = Post '/api/px/workOrderList/toPicking' @{ rows = (PickPayload $zero) } $tok
  Write-Output "④ 未排产守卫 [$($zero.'工单号') 排产=$($zero.'排产数量')]: code=$($r.code) msg=$($r.message)"
}

$r = Post '/api/px/workOrderList/toPicking' @{ rows = (PickPayload $good) } $tok
Write-Output "⑤ 正常转领料 [$($good.'工单号')#$($good.'工单行号') 排产=$($good.'排产数量') 生产线=$($good.'生产线')]"
Write-Output "   code=$($r.code) 张数=$($r.data.'转领料单张数') 清单=$($r.data.'单号清单' -join ',') 失败=$($r.data.'失败行' -join ';') gotoPanel=$($r.data.gotoPanel)"
if ($r.code -ne 200) { Write-Output "   [raw] $($script:lastRaw)" }

$r2 = Post '/api/px/workOrderList/toPicking' @{ rows = (PickPayload $good) } $tok
Write-Output "⑥ 重复转守卫(同一张工单再转一次): code=$($r2.code) msg=$($r2.message)"

$r3 = Post '/api/px/workOrderList/toPicking' @{ rows = @() } $tok
Write-Output "⑦ 空勾选守卫: code=$($r3.code) msg=$($r3.message)"

# 交付核对用:把新单号写进结果文件,交给 SqlRunner 查测试库
$newNo = ($r.data.'单号清单' -join ',')
Set-Content -Path "$PSScriptRoot\_verify-toPicking.result.txt" -Encoding UTF8 -Value @(
  "工单号=$($good.'工单号')",
  "工单行号=$($good.'工单行号')",
  "批次号=$($good.'批次号')",
  "领料单=$newNo"
)
Write-Output "⑧ 结果已写入 _verify-toPicking.result.txt: 工单=$($good.'工单号') 领料单=$newNo"


