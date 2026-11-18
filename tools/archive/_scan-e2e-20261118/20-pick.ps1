# 20-pick.ps1 — 手机扫码 ·「生产领料」(扫工单定位 → 扫物料 → 填数量 → 提交转材料出库单)
. (Join-Path $PSScriptRoot 'common.ps1')
$token = Connect-YjTest
$woNo = 'GD-2026-11-0010'
$line = 3

# ① 扫工单号定位单据(组装 + 混料 两张)
$loc = Api 'GET' ("/api/px/mobilePick/locate?woNo=$woNo&line=$line") $null $token
Check '生产领料·扫工单可定位' ($loc.Code -eq 200 -and (V $loc.Data 'found') -eq $true) ("code=" + $loc.Code)
$docs = Arr $loc.Data '单据'
Check '生产领料·定位到两张单(组装+混料)' ($docs.Count -eq 2) ("单据=" + $docs.Count + " 类型=" + (($docs | ForEach-Object { V $_ '领料类型' }) -join '+'))
$asm = $docs | Where-Object { (V $_ '领料类型') -eq '组装' } | Select-Object -First 1
$mix = $docs | Where-Object { (V $_ '领料类型') -eq '混料' } | Select-Object -First 1
Check '生产领料·拿到组装单 id' ($null -ne $asm) ("id=" + (V $asm 'id'))

# ② 单据详情
$doc = Api 'GET' ("/api/px/mobilePick/doc?id=" + (V $asm 'id')) $null $token
Check '生产领料·单据详情可读' ($doc.Code -eq 200) ("code=" + $doc.Code + ' ' + $doc.Message)
$items = Arr $doc.Data '领料明细'
Check '生产领料·领料明细有行' ($items.Count -gt 0) ("行数=" + $items.Count)
$pickable = @($items | Where-Object { (V $_ '半成品') -ne $true })
$semis = @($items | Where-Object { (V $_ '半成品') -eq $true })
Check '生产领料·可领项已排除半成品' ($pickable.Count -eq 2 -and $semis.Count -eq 1) ("可领=" + $pickable.Count + " 半成品=" + $semis.Count)

# ③ 扫半成品码:必须被拒(只显示不领料)
$semiCode = V ($semis | Select-Object -First 1) '编码'
$semiScan = Api 'POST' '/api/px/mobilePick/scanMaterial' ("{`"id`":" + (V $asm 'id') + ",`"code`":`"$semiCode`",`"side`":`"pick`"}") $token
$semiMsg = [string](V $semiScan 'Message')
Check '生产领料·扫半成品被拒(提示半成品)' ($semiScan.Code -ne 200 -and $semiMsg -like '*半成品*') ("code=" + $semiScan.Code + ' msg=' + $semiMsg)

# ④ 逐行扫物料 + 填数量(数量取「BOM需求」与「可用上限」的较小值)
foreach ($it in $pickable) {
  $code = V $it '编码'
  $need = [double](V $it 'BOM用量')
  $scan = Api 'POST' '/api/px/mobilePick/scanMaterial' ("{`"id`":" + (V $asm 'id') + ",`"code`":`"$code`",`"side`":`"pick`"}") $token
  Check ("生产领料·扫物料 " + $code) ($scan.Code -eq 200) ("可用上限=" + (V $scan.Data '允许上限') + ' ' + $scan.Message)
  $cap = [double](V $scan.Data '允许上限')
  $qty = [Math]::Min($need, $cap)
  if ($qty -le 0) { Check ("生产领料·" + $code + " 有可用库存") $false ("可用上限=" + $cap); continue }
  $body = "{`"id`":" + (V $asm 'id') + ",`"side`":`"pick`",`"code`":`"$code`",`"qty`":$qty}"
  $set = Api 'POST' '/api/px/mobilePick/setQty' $body $token
  Check ("生产领料·填数量 " + $code + " = " + $qty) ($set.Code -eq 200) ("可以提交=" + (V $set.Data '可以提交') + ' ' + $set.Message)
}

# ⑤ 提交 → 生成材料出库单(草稿,不扣库存)
$submit = Api 'POST' '/api/px/mobilePick/submit' ("{`"id`":" + (V $asm 'id') + "}") $token
Check '生产领料·提交成功' ($submit.Code -eq 200 -and (V $submit.Data '已提交') -eq $true) ("code=" + $submit.Code + ' ' + $submit.Message)
Check '生产领料·提交生成出库行数>0' ([double](V $submit.Data '出库行数') -gt 0) ("出库行数=" + (V $submit.Data '出库行数') + " 单号=" + (V $submit.Data '领料单号'))

# ⑥ 提交后回读:状态已完成、出库单待审批
$doc2 = Api 'GET' ("/api/px/mobilePick/doc?id=" + (V $asm 'id')) $null $token
Check '生产领料·提交后状态=已完成' ((V $doc2.Data '状态') -eq '已完成') ("状态=" + (V $doc2.Data '状态'))
Check '生产领料·出库单待仓管审批' ((V $doc2.Data '出库已审批') -eq $false) ("出库已审批=" + (V $doc2.Data '出库已审批'))

# ⑦ 混料单:扫一笔料验证取数,并验证「无库存物料会被库存闸门拦」(真实数据现状)
$mixDoc = Api 'GET' ("/api/px/mobilePick/doc?id=" + (V $mix 'id')) $null $token
$mixItems = Arr $mixDoc.Data '领料明细'
Check '生产领料·混料单明细可读' ($mixItems.Count -ge 4) ("行数=" + $mixItems.Count)
$mixFirst = $mixItems | Select-Object -First 1
$mixCode = V $mixFirst '编码'
$mixScan = Api 'POST' '/api/px/mobilePick/scanMaterial' ("{`"id`":" + (V $mix 'id') + ",`"code`":`"$mixCode`",`"side`":`"pick`"}") $token
Check '生产领料·混料单扫物料可读' ($mixScan.Code -eq 200) ("可用上限=" + (V $mixScan.Data '允许上限') + ' ' + $mixScan.Message)
$mixCap = [double](V $mixScan.Data '允许上限')
if ($mixCap -le 0) {
  $bad = Api 'POST' '/api/px/mobilePick/setQty' ("{`"id`":" + (V $mix 'id') + ",`"side`":`"pick`",`"code`":`"$mixCode`",`"qty`":1}") $token
  Check ('生产领料·无库存物料被库存闸门拦(' + $mixCode + ')') ($bad.Code -ne 200 -and [string](V $bad 'Message') -like '*库存不足*') ("code=" + $bad.Code + ' msg=' + (V $bad 'Message'))
} else {
  Check ('生产领料·混料物料有库存(' + $mixCode + ')') $true ("可用上限=" + $mixCap)
}

Write-Json ([pscustomobject]@{ 工单号 = $woNo; 行号 = $line; 组装id = (V $asm 'id'); 混料id = (V $mix 'id');
  组装单号 = (V $asm '领料单号'); 混料单号 = (V $mix '领料单号') }) 'evidence-pick.json' | Out-Null
Summary '生产领料'
