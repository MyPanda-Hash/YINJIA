# 50-mix.ps1 — 手机扫码 ·「扫码混料」(扫工单 → 一级BOM/物料清单 → 逐项扫料取秤 → 整单保存 → 补打印)
. (Join-Path $PSScriptRoot 'common.ps1')
$token = Connect-YjTest
$woNo = 'GD-2026-11-0010'
$line = 3

# ① 扫工单码 → 工单行
$ln = Api 'GET' ("/api/px/mix/lines?orderNo=$woNo&lineNo=$line") $null $token
Check '扫码混料·扫工单可带出工单行' ($ln.Code -eq 200 -and (Arr $ln.Data 'list').Count -ge 1) ("code=" + $ln.Code + ' ' + $ln.Message)
$wo = (Arr $ln.Data 'list') | Select-Object -First 1
$product = [string](V $wo '产品编码')
Check '扫码混料·工单行带产品/排产数量' (-not [string]::IsNullOrWhiteSpace($product) -and [double](V $wo '排产数量') -gt 0) ("产品=" + $product + " 排产=" + (V $wo '排产数量'))

# ② 一级 BOM(物料清单)取数
$bom = Api 'GET' ("/api/px/mix/bom?productCode=$product") $null $token
$bomRows = Arr $bom.Data 'list'
Check '扫码混料·物料清单可带出' ($bom.Code -eq 200 -and $bomRows.Count -ge 3) ("行数=" + $bomRows.Count + ' ' + $bom.Message)
Check '扫码混料·物料清单带用量' ([double](V ($bomRows | Select-Object -First 1) '标准用量') -gt 0) ("首行=" + (V ($bomRows | Select-Object -First 1) '子件代码') + " 用量=" + (V ($bomRows | Select-Object -First 1) '标准用量'))

# ③ 逐项扫料(电子秤读数 → 实际用量):扫两笔
$m1 = $bomRows[0]; $m2 = $bomRows[1]
$scan1 = Api 'POST' '/api/px/mix/scan' (J @{
    工单号 = $woNo; 工单行号 = $line; 工单行id = (V $wo '行id')
    产品编码 = $product; 产品名称 = (V $wo '产品名称')
    物料编号 = (V $m1 '子件代码'); 物料名称 = (V $m1 '子件名称')
    物料批次 = 'B20261117'; 计划用量 = (V $m1 '标准用量'); 实际用量 = 31.2
  }) $token
Check '扫码混料·第1笔落库' ($scan1.Code -eq 200) ("code=" + $scan1.Code + ' ' + $scan1.Message + " 行id=" + (V $scan1.Data '行id'))
$scan2 = Api 'POST' '/api/px/mix/scan' (J @{
    工单号 = $woNo; 工单行号 = $line; 工单行id = (V $wo '行id')
    产品编码 = $product; 产品名称 = (V $wo '产品名称')
    物料编号 = (V $m2 '子件代码'); 物料名称 = (V $m2 '子件名称')
    计划用量 = (V $m2 '标准用量'); 实际用量 = 20.5
  }) $token
Check '扫码混料·第2笔落库' ($scan2.Code -eq 200) ("code=" + $scan2.Code + ' ' + $scan2.Message)

# ④ 同一物料再扫:应累加到同一行(不新增行)
$scan1b = Api 'POST' '/api/px/mix/scan' (J @{
    工单号 = $woNo; 工单行号 = $line; 工单行id = (V $wo '行id')
    产品编码 = $product; 产品名称 = (V $wo '产品名称')
    物料编号 = (V $m1 '子件代码'); 实际用量 = 0.8
  }) $token
Check '扫码混料·同料重复扫累加到同一行' ($scan1b.Code -eq 200 -and [double](V $scan1b.Data '实际用量') -eq 32.0) ("实际用量=" + (V $scan1b.Data '实际用量'))

$draft = Api 'GET' ("/api/px/mix/draft?orderNo=$woNo&lineNo=$line") $null $token
$draftRows = Arr $draft.Data 'list'
Check '扫码混料·未保存草稿=2 行' ($draftRows.Count -eq 2) ("行数=" + $draftRows.Count)

# ⑤ 撤回一笔(只删未保存行)
$undoId = V ($draftRows | Where-Object { (V $_ '物料编号') -eq (V $m2 '子件代码') } | Select-Object -First 1) '行id'
$undo = Api 'POST' '/api/px/mix/undo' (J @{ 行id = [long]$undoId }) $token
Check '扫码混料·撤回一笔' ($undo.Code -eq 200 -and [double](V $undo.Data '删除行数') -eq 1) ("删除行数=" + (V $undo.Data '删除行数'))
$draft2 = Api 'GET' ("/api/px/mix/draft?orderNo=$woNo&lineNo=$line") $null $token
Check '扫码混料·撤回后草稿=1 行' ((Arr $draft2.Data 'list').Count -eq 1) ("行数=" + (Arr $draft2.Data 'list').Count)

# ⑥ 补扫回来,整单保存 → 取混料单号
$null2 = Api 'POST' '/api/px/mix/scan' (J @{
    工单号 = $woNo; 工单行号 = $line; 工单行id = (V $wo '行id')
    产品编码 = $product; 产品名称 = (V $wo '产品名称')
    物料编号 = (V $m2 '子件代码'); 实际用量 = 20.5
  }) $token
$save = Api 'POST' '/api/px/mix/save' (J @{ 工单号 = $woNo; 工单行号 = $line }) $token
$docNo = [string](V $save.Data '单据编号')
Check '扫码混料·整单保存成功' ($save.Code -eq 200 -and -not [string]::IsNullOrWhiteSpace($docNo)) ("code=" + $save.Code + ' 单号=' + $docNo + ' ' + $save.Message)
Check '扫码混料·单号形如 PL+日期+流水' ($docNo -match '^PL\d{10}$') ("单号=" + $docNo)
Check '扫码混料·保存行数=2' ([double](V $save.Data '行数') -eq 2) ("行数=" + (V $save.Data '行数') + " 合计=" + (V $save.Data '实际用量合计'))

# ⑦ 已保存后再整单保存:必须被拒(没有未保存行了)
$saveAgain = Api 'POST' '/api/px/mix/save' (J @{ 工单号 = $woNo; 工单行号 = $line }) $token
Check '扫码混料·无草稿再保存被拒' ($saveAgain.Code -ne 200 -and [string](V $saveAgain 'Message') -like '*还没有已扫的料*') ("code=" + $saveAgain.Code + ' msg=' + (V $saveAgain 'Message'))

# ⑧ 补打印入口:重扫工单列出已保存的混料单 + 取单 + 记打印
$docs = Api 'GET' ("/api/px/mix/docs?orderNo=$woNo&lineNo=$line") $null $token
Check '扫码混料·补打印列表能列出该单' ($docs.Code -eq 200 -and [double](V $docs.Data '条数') -ge 1) ("条数=" + (V $docs.Data '条数'))
$doc = Api 'GET' ("/api/px/mix/doc?docNo=$docNo") $null $token
Check '扫码混料·按单号取抬头+明细' ($doc.Code -eq 200) ("code=" + $doc.Code + ' ' + $doc.Message)
$docLines = Arr $doc.Data '明细'
Check '扫码混料·单据明细有 2 行' ($docLines.Count -eq 2) ("行数=" + $docLines.Count)
$printed = Api 'POST' '/api/px/mix/printed' (J @{ 单据编号 = $docNo }) $token
Check '扫码混料·记一次打印(补打印)' ($printed.Code -eq 200) ("code=" + $printed.Code + ' ' + $printed.Message)

Write-Json ([pscustomobject]@{ 工单号 = $woNo; 工单行号 = $line; 混料单号 = $docNo; 行数 = 2 }) 'evidence-mix.json' | Out-Null
Summary '扫码混料'
