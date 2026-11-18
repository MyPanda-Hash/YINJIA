# 60-report.ps1 — 手机扫码 ·「工序报工」(扫工单码 → 选工序 → 填完工数量 → 提交即报工并审核)
. (Join-Path $PSScriptRoot 'common.ps1')
$token = Connect-YjTest
$woNo = 'GD-2026-11-0018'
$line = 1

# ① 扫工单码 → 报工上下文(工单行 + 工序台账 + 可加工量)
$ctx = Api 'GET' ("/api/px/workReport/context?woNo=$woNo&line=$line") $null $token
Check '工序报工·扫工单可带出上下文' ($ctx.Code -eq 200) ("code=" + $ctx.Code + ' ' + $ctx.Message)
$ledger = Arr $ctx.Data '工序台账'
Check '工序报工·工序台账有行' ($ledger.Count -ge 1) ("工序=" + (($ledger | ForEach-Object { V $_ '工序' }) -join '/'))
Check '工序报工·带可加工量/剩余可报' ((V ($ledger | Select-Object -First 1) '剩余可报') -ne $null) ("首道=" + (V ($ledger | Select-Object -First 1) '工序') + " 剩余可报=" + (V ($ledger | Select-Object -First 1) '剩余可报'))

# ② 挑一道「还能报」的工序(剩余可报 > 0),报 1 个
$op = $null
foreach ($r in $ledger) { if ([double](V $r '剩余可报') -gt 0) { $op = $r; break } }
Check '工序报工·找到可报工序' ($null -ne $op) ("工序=" + (V $op '工序') + " 剩余可报=" + (V $op '剩余可报'))
if (-not $op) { Summary '工序报工'; return }

# ③ 数量 0 必须被拒
$bad = Api 'POST' '/api/px/workReport/submit' (J @{ woNo = $woNo; 工序 = (V $op '工序'); 数量 = 0; 报工人 = 'admin'; 工单行号 = $line }) $token
Check '工序报工·数量 0 被拒' ($bad.Code -ne 200) ("code=" + $bad.Code + ' msg=' + (V $bad 'Message'))

# ④ 正常报 1 个
$ok = Api 'POST' '/api/px/workReport/submit' (J @{
    woNo = $woNo; 工序 = (V $op '工序'); 数量 = 1; 报工人 = 'admin'; 工单行号 = $line
  }) $token
$bgNo = [string](V $ok.Data '报工单号')
Check '工序报工·提交成功' ($ok.Code -eq 200) ("code=" + $ok.Code + ' ' + $ok.Message)
Check '工序报工·拿到报工单号' (-not [string]::IsNullOrWhiteSpace($bgNo)) ("报工单号=" + $bgNo)
Check '工序报工·管理员当场审核生效' ((V $ok.Data '生效方式') -eq '已审核') ("生效方式=" + (V $ok.Data '生效方式'))

# ⑤ 回读:今日报工里能看到这一笔,工序进度随之变化
$ctx2 = Api 'GET' ("/api/px/workReport/context?woNo=$woNo&line=$line") $null $token
$today = Arr $ctx2.Data '今日报工'
Check '工序报工·今日报工里出现该单' ($today.Count -ge 1 -and (($today | ForEach-Object { V $_ '报工单号' }) -contains $bgNo)) ("今日报工=" + $today.Count)
$opAfter = (Arr $ctx2.Data '工序台账') | Where-Object { (V $_ '工序') -eq (V $op '工序') } | Select-Object -First 1
Check '工序报工·该工序已报工量增加' ([double](V $opAfter '已报工') -ge 1) ("已报工=" + (V $opAfter '已报工') + "（报前=" + (V $op '已报工') + "）")

Write-Json ([pscustomobject]@{ 工单号 = $woNo; 工单行号 = $line; 工序 = (V $op '工序'); 报工单号 = $bgNo }) 'evidence-report.json' | Out-Null
Summary '工序报工'
