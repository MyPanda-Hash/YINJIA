# _verify-calc-amount.ps1 — 「明细自动计算」端到端验收(2026-10-05 采购入库单金额任务)
#
# 验的是**服务端**这一半(改前只有浏览器在算;生单/保存两条落库路径从来不重算):
#   ① 保存路径:故意把 金额/含税单价/含税金额 传成错的(999999),保存后应被服务端按公式改对;
#   ② 生单路径:新建来料检验单(合格数量 100 / 单价 10)→ 审核 → 自动生成的采购入库单
#      金额应已算好(= 1000),而不是空;
#   ③ 新增规则:来料检验单「损耗率 = 损耗 / 送检数量」。
#
# 全程打在**测试账套 YJ_TEST**(登录工厂切换;AGENTS.md 两账套纪律:演示/造数只在测试库)。
#
# 用法: powershell -ExecutionPolicy Bypass -File tools\archive\_verify-calc-amount.ps1
# 前置: 8090 后端在跑(带本次改动);否则先 tools\scripts\start-prod.ps1
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8090'
$fail = 0

function PostJson($path, $obj, $token) {
  $f = Join-Path $env:TEMP 'yj-verify-body.json'
  [System.IO.File]::WriteAllText($f, ($obj | ConvertTo-Json -Depth 20 -Compress), (New-Object System.Text.UTF8Encoding $false))
  $hdr = @('-s', '-X', 'POST', "$base$path", '-H', 'Content-Type: application/json')
  if ($token) { $hdr += @('-H', "Authorization: Bearer $token") }
  $hdr += @('-d', "@$f")
  return (& curl.exe @hdr) | ConvertFrom-Json
}
function Check($label, $actual, $expected) {
  # 数值按数值比(库里是 decimal(18,4),JSON 回来是 "6.0000" 而期望写 6)
  $a = 0.0; $e = 0.0
  $numeric = [double]::TryParse([string]$actual, [ref]$a) -and [double]::TryParse([string]$expected, [ref]$e)
  $ok = $false
  if ($numeric) { $ok = ([math]::Abs($a - $e) -lt 0.00005) } else { $ok = ([string]$actual -eq [string]$expected) }
  $tag = 'FAIL'; if ($ok) { $tag = 'PASS' } else { $script:fail++ }
  Write-Output ("  [{0}] {1}: 实际={2} 期望={3}" -f $tag, $label, $actual, $expected)
}

# ---------- 登录测试账套 ----------
$lf = Join-Path $env:TEMP 'yj-verify-login.json'
[System.IO.File]::WriteAllText($lf, '{"userName":"admin","password":"123456","factory":"YJ_TEST"}', (New-Object System.Text.UTF8Encoding $false))
$login = (& curl.exe -s -X POST "$base/api/auth/login" -H 'Content-Type: application/json' -d "@$lf") | ConvertFrom-Json
if ($login.code -ne 200) { throw "登录失败: $($login.message)" }
$token = $login.data.token
Write-Output "登录工厂 = $($login.data.user.factory)(应为 YJ_TEST = 测试账套)"

# ---------- ① 保存路径:服务端重算 ----------
Write-Output '① 保存路径:传错的金额应被服务端按公式改对'
$q = PostJson '/api/px/queryFormDataList' @{ panelCode = 'PURCHASE_IN'; pageNo = 1; pageSize = 5; condition = @{ '单据编号' = 'PI-2026-10-0025' } } $token
if (-not $q.data.list.Count) { throw '测试账套缺 PI-2026-10-0025(本机测试库既有草稿单),请先造一张' }
$row = @{}
$q.data.list[0].detail.items[0].PSObject.Properties | ForEach-Object { $row[$_.Name] = $_.Value }
$row['实收数量'] = 2; $row['单价'] = 3
$row['金额'] = 999999; $row['含税单价'] = 999999; $row['含税金额'] = 999999
$s = PostJson '/api/px/callButton' @{ panelCode = 'PURCHASE_IN'; buttonName = '提交'
  formData = @{ '编号' = 'PI-2026-10-0025'; detail = @{ items = @($row) } }; buttonParam = @{} } $token
Check '保存返回码' $s.code 200
$r1 = (PostJson '/api/px/queryFormDataList' @{ panelCode = 'PURCHASE_IN'; pageNo = 1; pageSize = 5; condition = @{ '单据编号' = 'PI-2026-10-0025' } } $token).data.list[0].detail.items[0]
Check '金额(2×3)' $r1.'金额' 6
Check '含税金额(2×3)' $r1.'含税金额' 6
Check '含税单价(无税率=单价)' $r1.'含税单价' 3

# ---------- ② 生单路径:检验单审核 → 入库单金额已算 ----------
Write-Output '② 生单路径:来料检验单审核自动生成的采购入库单,金额应已算'
$new = PostJson '/api/px/callButton' @{ panelCode = 'QC_INSP'; buttonName = '提交'; formData = @{
    '单据日期' = (Get-Date -Format 'yyyy-MM-dd'); '供应商' = '验证用供应商'; '供应商代码' = 'Y-YZ'
    detail = @{ items = @(@{ '物料编码' = 'Y-S-T'; '物料名称' = '验证料A'; '规格型号' = 'Φ20'; '计量单位' = 'kg'
                              '送检数量' = 100; '合格数量' = 100; '不合格数量' = 0; '单价' = 10; '仓库代码' = '原料仓' }) }
  }; buttonParam = @{} } $token
Check '新建检验单' $new.code 200
$qcNo = $new.data.'编号'
$aud = PostJson '/api/px/callButton' @{ panelCode = 'QC_INSP'; buttonName = '审核'; formData = @{ '编号' = $qcNo }; buttonParam = @{} } $token
Check '检验单审核' $aud.code 200
$pi = (PostJson '/api/px/queryFormDataList' @{ panelCode = 'PURCHASE_IN'; pageNo = 1; pageSize = 5; condition = @{ '来源单号' = $qcNo } } $token).data.list[0]
$piCount = 0
if ($pi -ne $null) { $piCount = 1 }
Check '自动生成入库单数' $piCount 1
$prow = $pi.detail.items[0]
Check '入库行 实收数量(=合格数量)' $prow.'实收数量' 100
Check '入库行 金额(=100×10)' $prow.'金额' 1000
Check '入库行 含税金额' $prow.'含税金额' 1000

# ---------- ③ 新增规则:损耗率 ----------
Write-Output '③ 来料检验单「损耗率 = 损耗 / 送检数量」'
$q3 = PostJson '/api/px/queryFormDataList' @{ panelCode = 'QC_INSP'; pageNo = 1; pageSize = 2; condition = @{ '单据编号' = 'IJ-2026-10-0054' } } $token
if ($q3.data.list.Count) {
  $h = @{}
  $q3.data.list[0].detail.items[0].PSObject.Properties | ForEach-Object { $h[$_.Name] = $_.Value }
  $h['送检数量'] = 100; $h['合格数量'] = 95; $h['损耗'] = 5; $h['损耗率'] = 999
  $null = PostJson '/api/px/callButton' @{ panelCode = 'QC_INSP'; buttonName = '提交'
    formData = @{ '编号' = 'IJ-2026-10-0054'; detail = @{ items = @($h) } }; buttonParam = @{} } $token
  $r3 = (PostJson '/api/px/queryFormDataList' @{ panelCode = 'QC_INSP'; pageNo = 1; pageSize = 2; condition = @{ '单据编号' = 'IJ-2026-10-0054' } } $token).data.list[0].detail.items[0]
  Check '损耗率(5/100)' $r3.'损耗率' 0.05
} else {
  Write-Output '  [SKIP] 测试账套无 IJ-2026-10-0054,跳过错损率断言'
}

Write-Output ''
if ($fail -eq 0) { Write-Output '== 全部 PASS ==' } else { Write-Output "== 失败 $fail 项 ==" ; exit 1 }
