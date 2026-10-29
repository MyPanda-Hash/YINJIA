# qa-transfer-success.ps1 — 2026-10-29 调拨收口:**成功路径**验收(在测试账套 HSDZ_MES_TEST 的 8091 实例上做,
# 不动正式库业务数据):调拨到同工序的另一条线 → 写轨迹 → 撤回调拨回到原线。
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$base = 'http://127.0.0.1:8091'

function Post($path, $body, $raw = $false) {
  $h = @{}
  if ($script:token) { $h['Authorization'] = "Bearer $($script:token)" }
  $json = $body | ConvertTo-Json -Depth 10 -Compress
  $r = Invoke-WebRequest -Uri "$base$path" -Method Post -ContentType 'application/json; charset=utf-8' `
    -Body ([Text.Encoding]::UTF8.GetBytes($json)) -Headers $h -SkipHttpErrorCheck
  $obj = ([Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())) | ConvertFrom-Json
  if ($raw) { return $obj }
  if ($obj.code -ne 200) { throw "API $path 失败 code=$($obj.code) msg=$($obj.message)" }
  return $obj
}

$login = Post '/api/auth/login' @{ userName = 'admin'; password = '123456' }
$script:token = $login.data.token
"登录 OK: $($login.data.user.userName)"

$lines = (Post '/api/px/scheduleBoard/linesSummary' @{}).data
$cheng = @($lines | Where-Object { $_.生产车间 -eq '成型' -and -not $_.停用 })
"成型线 $($cheng.Count) 条"

# 找一条「未完工」的成型行
$row = $null; $fromLine = $null
foreach ($l in $cheng) {
  $rows = (Post '/api/px/scheduleBoard/scheduled' @{ 生产线 = $l.生产线; scope = '未完工' }).data
  $c = $rows | Where-Object { $_.当前工序 -eq '成型' } | Select-Object -First 1
  if ($c) { $row = $c; $fromLine = $l.生产线; break }
}
if (-not $row) { throw '测试库里没有未完工的成型行,无法做成功路径验收' }
"被测:工单=$($row.加工单号) 行$($row.工单行号) 行id=$($row.行id) 当前工序=$($row.当前工序) 原线=$fromLine"
$rows1 = @(@{ 工单号 = $row.加工单号; 行id = $row.行id; 工单行号 = $row.工单行号; 批次号 = $row.批次号 })

"`n== 1) 候选线(应只有成型车间、且不含原线)=="
$t = (Post '/api/px/scheduleBoard/transferTargets' @{ rows = $rows1 }).data
"工序=$($t.工序 -join ',') 车间=$($t.车间 -join ',') 候选线=$($t.产线.Count) 可调拨=$($t.可调拨)"
"  含原线=$([bool]($t.产线 | Where-Object { $_.生产线 -eq $fromLine }))  候选车间=$(($t.产线 | ForEach-Object { $_.生产车间 } | Sort-Object -Unique) -join ',')"
$toLine = ($t.产线 | Where-Object { $_.生产线 -ne $fromLine } | Select-Object -First 1).生产线
"  目标线:$toLine"

"`n== 2) 调拨:同工序换线 → 成功 =="
$ok = Post '/api/px/scheduleBoard/transfer' @{ rows = $rows1; 目标生产线 = $toLine; 原因 = '自动化验收(测试库)' }
"调拨张数=$($ok.data['调拨张数']) 目标=$($ok.data['目标']) 失败行=$($ok.data['失败行'] -join ';')"
"  单号清单:$($ok.data['单号清单'] -join ',')"

"`n== 3) 新线上应出现该行,原线不应再有 =="
$onNew = (Post '/api/px/scheduleBoard/scheduled' @{ 生产线 = $toLine; scope = '全部' }).data | Where-Object { $_.行id -eq $row.行id }
$onOld = (Post '/api/px/scheduleBoard/scheduled' @{ 生产线 = $fromLine; scope = '全部' }).data | Where-Object { $_.行id -eq $row.行id }
"新线命中=$([bool]$onNew) 原线命中=$([bool]$onOld)"

"`n== 4) 撤回调拨 → 应回到原线 =="
$rv = Post '/api/px/scheduleBoard/transferRevoke' @{ rows = $rows1 }
"撤回张数=$($rv.data['撤回张数']) 清单=$($rv.data['单号清单'] -join ',') 失败行=$($rv.data['失败行'] -join ';')"
$back = (Post '/api/px/scheduleBoard/scheduled' @{ 生产线 = $fromLine; scope = '全部' }).data | Where-Object { $_.行id -eq $row.行id }
$stillNew = (Post '/api/px/scheduleBoard/scheduled' @{ 生产线 = $toLine; scope = '全部' }).data | Where-Object { $_.行id -eq $row.行id }
"已回原线=$([bool]$back) 新线已无该行=$(-not [bool]$stillNew)"
