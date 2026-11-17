# 30-return.ps1 — 手机扫码 ·「生产退料」(扫已审领料单 → 扫物料 → 填退料数量 → 提交生成生产退料单)
. (Join-Path $PSScriptRoot 'common.ps1')
$token = Connect-YjTest

# ① 可退列表:只列「已完成 + 材料出库单已审核」的领料单
$ret = Api 'GET' '/api/px/mobilePick/returnables' $null $token
Check '生产退料·可退列表可读' ($ret.Code -eq 200) ("code=" + $ret.Code + ' ' + $ret.Message)
$list = Arr $ret.Data 'list'
Check '生产退料·有可退单据' ($list.Count -gt 0) ("单据数=" + $list.Count + " 可退合计=" + (V $ret.Data '可退合计数'))

# 挑一张「还没退过料」的,便于验证退料链路是干净的
$target = $list | Where-Object { [double](V $_ '已退数量') -eq 0 -and [double](V $_ '可退数量') -gt 0 } | Select-Object -First 1
Check '生产退料·找到未退过料的单' ($null -ne $target) ("单号=" + (V $target '领料单号') + " 可退=" + (V $target '可退数量'))
if (-not $target) { Summary '生产退料'; return }

$id = V $target 'id'
$outNo = V $target '领料单号'

# ② 单据明细:取一行有数量的物料来退
$doc = Api 'GET' ("/api/px/mobilePick/doc?id=$id") $null $token
$items = Arr $doc.Data '领料明细'
$line = $items | Where-Object { [double](V $_ '数量') -gt 0 } | Select-Object -First 1
Check '生产退料·找到已领行' ($null -ne $line) ("行数=" + $items.Count)
if (-not $line) { Summary '生产退料'; return }
$code = V $line '编码'

# ③ 扫物料码:返回已领 / 已退 / 可退
$scan = Api 'POST' '/api/px/mobilePick/returnScan' (J @{ id = [long]$id; code = $code }) $token
Check '生产退料·扫物料可读' ($scan.Code -eq 200) ("code=" + $scan.Code + ' ' + $scan.Message)
Check '生产退料·可退数量>0' ([double](V $scan.Data '可退数量') -gt 0) ("已领=" + (V $scan.Data '已领数量') + " 已退=" + (V $scan.Data '已退数量') + " 可退=" + (V $scan.Data '可退数量'))
Check '生产退料·扫不在单里的物料被拒' ((Api 'POST' '/api/px/mobilePick/returnScan' (J @{ id = [long]$id; code = 'NOT-EXIST-XYZ' }) $token).Code -ne 200) ''

# ④ 提交退料(退 1 个,量小、可再退)
$qty = [Math]::Min(1.0, [double](V $scan.Data '可退数量'))
$body = J @{ id = [long]$id; items = @(@{ code = $code; qty = $qty }) }
$sub = Api 'POST' '/api/px/mobilePick/submitReturn' $body $token
Check '生产退料·提交成功' ($sub.Code -eq 200) ("code=" + $sub.Code + ' ' + $sub.Message)
$backNo = V $sub.Data '退料单号'
Check '生产退料·拿到生产退料单号' (-not [string]::IsNullOrWhiteSpace([string]$backNo)) ("退料单号=" + $backNo + " 合计=" + (V $sub.Data '合计数量'))

# ⑤ 退料后回读:已退数量涨了
$doc2 = Api 'GET' ("/api/px/mobilePick/doc?id=$id") $null $token
Check '生产退料·单据已退合计>0' ([double](V $doc2.Data '已退合计') -gt 0) ("已退合计=" + (V $doc2.Data '已退合计') + " 含退料=" + (V $doc2.Data '含退料'))

# ⑥ 超退守卫:再退一个远超可退的量必须被拒
$over = Api 'POST' '/api/px/mobilePick/submitReturn' (J @{ id = [long]$id; items = @(@{ code = $code; qty = 999999 }) }) $token
Check '生产退料·超退被拒' ($over.Code -ne 200 -and [string](V $over 'Message') -like '*可退只剩*') ("code=" + $over.Code + ' msg=' + (V $over 'Message'))

Write-Json ([pscustomobject]@{ 领料单号 = $outNo; 台账id = $id; 退料物料 = $code; 退料数量 = $qty; 退料单号 = $backNo }) 'evidence-return.json' | Out-Null
Summary '生产退料'
