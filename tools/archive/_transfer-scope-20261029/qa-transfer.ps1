# qa-transfer.ps1 — 2026-10-29 调拨收口:接口级验收(只读 + 只测"该被拒"的分支,不写任何业务数据)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$base = 'http://127.0.0.1:8090'
$token = (Get-Content 'D:\workspace\yinjia\.tmp\mytask-token.txt' -Raw).Trim()

function Post($path, $body, $raw = $false) {
  $h = @{ Authorization = "Bearer $token" }
  $json = $body | ConvertTo-Json -Depth 10 -Compress
  $r = Invoke-WebRequest -Uri "$base$path" -Method Post -ContentType 'application/json; charset=utf-8' `
    -Body ([Text.Encoding]::UTF8.GetBytes($json)) -Headers $h -SkipHttpErrorCheck
  $txt = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
  $obj = $txt | ConvertFrom-Json
  if ($raw) { return $obj }
  if ($obj.code -ne 200) { throw "API $path 失败 code=$($obj.code) msg=$($obj.message)" }
  return $obj
}

$lines = (Post '/api/px/scheduleBoard/linesSummary' @{}).data
$cheng = @($lines | Where-Object { $_.生产车间 -eq '成型' -and -not $_.停用 })
$zu = @($lines | Where-Object { $_.生产车间 -eq '组装' -and -not $_.停用 })
"成型线 $($cheng.Count) 条 / 组装线 $($zu.Count) 条"

# 两个真实已排产行(来自 Probe2 取证):成型(GD-2026-10-0227 行1)与组装(GD-2026-09-0222 行1)
$schedC = (Post '/api/px/scheduleBoard/scheduled' @{ 生产线 = '2号车间'; scope = '未完工' }).data
$rowC = $schedC | Where-Object { $_.当前工序 -eq '成型' } | Select-Object -First 1
$rowZ = $null
foreach ($zl in $zu) {
  $rowsOnLine = (Post '/api/px/scheduleBoard/scheduled' @{ 生产线 = $zl.生产线; scope = '全部' }).data
  $cand = $rowsOnLine | Where-Object { $_.当前工序 -eq '组装' -and $_.生产状态 -ne '已结案' } | Select-Object -First 1
  if ($cand) { $rowZ = $cand; break }
}
"成型行:$($rowC.加工单号)#$($rowC.工单行号) 当前工序=$($rowC.当前工序)"
"组装行:$($rowZ.加工单号)#$($rowZ.工单行号) 当前工序=$($rowZ.当前工序)"
$rowsC = @(@{ 工单号 = $rowC.加工单号; 行id = $rowC.行id; 工单行号 = $rowC.工单行号; 批次号 = $rowC.批次号 })
$rowsZ = @(@{ 工单号 = $rowZ.加工单号; 行id = $rowZ.行id; 工单行号 = $rowZ.工单行号; 批次号 = $rowZ.批次号 })

"`n== 1) 成型行候选 =="
$t1 = (Post '/api/px/scheduleBoard/transferTargets' @{ rows = $rowsC }).data
"工序=$($t1.工序 -join ',') 车间=$($t1.车间 -join ',') 可调拨=$($t1.可调拨) 候选线=$($t1.产线.Count) 提示=[$($t1.提示)]"
"  候选车间:$(($t1.产线 | ForEach-Object { $_.生产车间 } | Sort-Object -Unique) -join ',')  含2号车间=$([bool]($t1.产线 | Where-Object { $_.生产线 -eq '2号车间' }))"

"`n== 2) 组装行候选 =="
$t2 = (Post '/api/px/scheduleBoard/transferTargets' @{ rows = $rowsZ }).data
"工序=$($t2.工序 -join ',') 车间=$($t2.车间 -join ',') 可调拨=$($t2.可调拨) 候选线=$($t2.产线.Count) 提示=[$($t2.提示)]"
"  候选车间:$(($t2.产线 | ForEach-Object { $_.生产车间 } | Sort-Object -Unique) -join ',')"

"`n== 3) 成型单调到组装线 → 守卫拒绝(不写库) =="
$bad = Post '/api/px/scheduleBoard/transfer' @{ rows = $rowsC; 目标生产线 = ($zu[0].生产线) } $true
"code=$($bad.code) msg=$($bad.message)"

"`n== 4) 组装单调到成型线 → 守卫拒绝 =="
$bad = Post '/api/px/scheduleBoard/transfer' @{ rows = $rowsZ; 目标生产线 = ($cheng[0].生产线) } $true
"code=$($bad.code) msg=$($bad.message)"

"`n== 5) 旧入口 /reassign 同样拒绝 → 只剩一条改线路径 =="
$bad = Post '/api/px/scheduleBoard/reassign' @{ rows = $rowsZ; 目标生产线 = ($cheng[0].生产线) } $true
"code=$($bad.code) msg=$($bad.message)"

"`n== 6) 成型 + 组装 混选 → 无交集候选 + 提示分行调拨 =="
$t3 = (Post '/api/px/scheduleBoard/transferTargets' @{ rows = @($rowsC[0], $rowsZ[0]) }).data
"工序=$($t3.工序 -join ',') 可调拨=$($t3.可调拨) 候选线=$($t3.产线.Count) 提示=[$($t3.提示)]"
"  逐行:$($t3.逐行 | ConvertTo-Json -Compress)"

"`n== 7) 未发生写入:两个行都还在原线 =="
$after = (Post '/api/px/scheduleBoard/scheduled' @{ 生产线 = '2号车间'; scope = '未完工' }).data
$hit = $after | Where-Object { $_.行id -eq $rowC.行id }
"成型行仍在 2号车间=$([bool]$hit)"
$after2 = (Post '/api/px/scheduleBoard/scheduled' @{ 生产线 = '组装1(老厂)'; scope = '未完工' }).data
$hit2 = $after2 | Where-Object { $_.行id -eq $rowZ.行id }
"组装行仍在 组装1(老厂)=$([bool]$hit2)"
