# 40-other.ps1 — 手机扫码 ·「其他领料 / 其他退料」(只扫物料码,扫完点提交即生单)
#   与前端一致:callButton(panelCode, buttonName='提交', formData=buildForm(...))
. (Join-Path $PSScriptRoot 'common.ps1')
$token = Connect-YjTest
$mat = 'YJ-XH-001'          # 鑫恒（80-250）,恒亿仓有库存
$matName = '鑫恒（80-250）'
$wh = '恒亿仓'
$whCode = 'YCL-01'
$uom = 'kg'
$today = Today

# ① 其他领料 → 其他出库单(OTHER_OUT)
$outForm = @{
  单据日期 = $today; 单据编号 = ''; 业务类型 = '其他出库'; 单据状态 = '草稿'
  备注 = '扫码其他领料(移动端)'; 经手人 = 'admin'; 经手人编码 = 'admin'
  detail = @{ items = @(@{
        行号 = '1'; 存货编码 = $mat; 存货名称 = $matName; 规格型号 = ''
        计量单位 = $uom; 仓库 = $wh; 仓库编码 = $whCode; 批次号 = ''
        数量 = 1; 单价 = 0; 金额 = 0; 明细备注 = '扫码其他领料'
      }) }
}
$r1 = Api 'POST' '/api/px/callButton' (J @{ panelCode = 'OTHER_OUT'; buttonName = '提交'; formData = $outForm; buttonParam = @{} }) $token
$outNo = [string](V $r1.Data '编号')
Check '其他领料·提交成功' ($r1.Code -eq 200) ("code=" + $r1.Code + ' ' + $r1.Message)
Check '其他领料·拿到其他出库单号' (-not [string]::IsNullOrWhiteSpace($outNo)) ("单号=" + $outNo)

# ② 其他退料 → 生产退料单(MATERIAL_RET)
$retForm = @{
  单据日期 = $today; 单据编号 = ''; 业务类型 = '生产退料'; 单据状态 = '草稿'
  备注 = '扫码其他退料(移动端)'; 领用人 = 'admin'; 经手人编码 = 'admin'
  detail = @{ items = @(@{
        行号 = '1'; 材料编码 = $mat; 材料名称 = $matName; 规格型号 = ''
        计量单位 = $uom; 仓库 = $wh; 仓库编码 = $whCode; 批次号 = ''
        数量 = 1; 单价 = 0; 金额 = 0; 明细备注 = '扫码其他退料'
      }) }
}
$r2 = Api 'POST' '/api/px/callButton' (J @{ panelCode = 'MATERIAL_RET'; buttonName = '提交'; formData = $retForm; buttonParam = @{} }) $token
$retNo = [string](V $r2.Data '编号')
Check '其他退料·提交成功' ($r2.Code -eq 200) ("code=" + $r2.Code + ' ' + $r2.Message)
Check '其他退料·拿到生产退料单号' (-not [string]::IsNullOrWhiteSpace($retNo)) ("单号=" + $retNo)

# ③ 补打印取数(其他领料/其他退料的纸面报表走 /px/slip/rows)
$slip = Api 'POST' '/api/px/slip/rows' (J @{ 面板 = 'OTHER_OUT'; 单据编号 = $outNo }) $token
Check '其他领料·补打印取数可读' ($slip.Code -eq 200) ("code=" + $slip.Code + ' ' + $slip.Message)
$rows = Arr $slip.Data '明细'
Check '其他领料·补打印明细有行' ($rows.Count -ge 1) ("行数=" + $rows.Count)
$slipRet = Api 'POST' '/api/px/slip/rows' (J @{ 面板 = 'MATERIAL_RET'; 单据编号 = $retNo }) $token
Check '其他退料·补打印取数可读' ($slipRet.Code -eq 200) ("code=" + $slipRet.Code + ' ' + $slipRet.Message)

# ④ 空清单提交要被拒(与前端"扫完才提交"一致)
$emptyForm = @{ 单据日期 = $today; 单据编号 = ''; 业务类型 = '其他出库'; 单据状态 = '草稿'; detail = @{ items = @() } }
$bad = Api 'POST' '/api/px/callButton' (J @{ panelCode = 'OTHER_OUT'; buttonName = '提交'; formData = $emptyForm; buttonParam = @{} }) $token
if ($bad.Code -ne 200) { Check '其他领料·无明细提交被拒' $true ("code=" + $bad.Code) } else { Warn '其他领料·空清单提交后端没拦(生成空单)' ('单号=' + (V $bad.Data '编号')) }

Write-Json ([pscustomobject]@{ 其他出库单 = $outNo; 其他退料单 = $retNo }) 'evidence-other.json' | Out-Null
Summary '其他领料退料'
