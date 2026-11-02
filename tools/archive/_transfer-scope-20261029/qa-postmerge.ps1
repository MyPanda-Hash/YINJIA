# qa-postmerge.ps1 — 2026-10-30 合并 origin/main(04e9672a / cc20b19c)后重建 jar:本任务(调拨收口)回归 + 冒烟(对着 8090)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$base = 'http://127.0.0.1:8090'
$script:token = $null

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
"1) 登录 OK: $($login.data.user.userName)"

$lines = (Post '/api/px/scheduleBoard/linesSummary' @{}).data
"2) 产线骨架 OK: $($lines.Count) 条(成型 $(($lines | Where-Object { $_.生产车间 -eq '成型' }).Count) / 切炭 $(($lines | Where-Object { $_.生产车间 -eq '切炭' }).Count) / 组装 $(($lines | Where-Object { $_.生产车间 -eq '组装' }).Count))"

$stats = (Post '/api/px/scheduleBoard/stats' @{}).data
"3) 统计 OK: 待排产=$($stats.'待排产笔数') 今日排产张数=$($stats.'今日排产'.'张数')"

$sched = (Post '/api/px/scheduleBoard/scheduled' @{ 生产线 = '2号车间'; scope = '未完工' }).data
$row = $sched | Where-Object { $_.当前工序 -eq '成型' } | Select-Object -First 1
if (-not $row) { throw '没有可测的成型行(数据变化了?)' }
$rows1 = @(@{ 工单号 = $row.加工单号; 行id = $row.行id; 工单行号 = $row.工单行号; 批次号 = $row.批次号 })
"4) 被测行: $($row.加工单号)#$($row.工单行号)(行id=$($row.行id)) 当前工序=$($row.当前工序) 现线=2号车间"

$t = (Post '/api/px/scheduleBoard/transferTargets' @{ rows = $rows1 }).data
"5) 调拨候选: 工序=$($t.工序 -join ',') 车间=$($t.车间 -join ',') 候选线=$($t.产线.Count) 可调拨=$($t.可调拨) 含原线=$([bool]($t.产线 | Where-Object { $_.生产线 -eq '2号车间' })) 候选车间去重=$(($t.产线 | ForEach-Object { $_.生产车间 } | Sort-Object -Unique) -join ',')"

$bad = Post '/api/px/scheduleBoard/transfer' @{ rows = $rows1; 目标生产线 = '切炭线' } $true
"6) 调到切炭线: code=$($bad.code) msg=$($bad.message)"

$bad2 = Post '/api/px/scheduleBoard/reassign' @{ rows = $rows1; 目标生产线 = '切炭线' } $true
"7) 旧入口 /reassign: code=$($bad2.code)"

# 旁证:该行仍在原线(未写入)
$after = (Post '/api/px/scheduleBoard/scheduled' @{ 生产线 = '2号车间'; scope = '未完工' }).data | Where-Object { $_.行id -eq $row.行id }
"8) 仍在 2号车间=$([bool]$after)"

# 合并进来的功能冒烟(至少证明映射/查询没被合并弄坏)
$wo = Post '/api/px/workOrderList/list' @{ page = 1; pageSize = 5 } $true
"9) 生产工单列表: code=$($wo.code) 行数=$($wo.data.list.Count)"
$trace = Post '/api/px/scheduleBoard/trace' @{ 工单号 = $row.加工单号; 工单行id = $row.行id } $true
"10) 工单追溯: code=$($trace.code) 段=$(@($trace.data.PSObject.Properties.Name).Count)"
