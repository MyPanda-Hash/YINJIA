$enc = New-Object System.Text.UTF8Encoding($false)
$pin = [System.IO.File]::ReadAllText("D:\YINJIA-main\_scratch\server-pin-full.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$po  = [System.IO.File]::ReadAllText("D:\YINJIA-main\_scratch\server-po-full.json", [System.Text.Encoding]::UTF8) | ConvertFrom-Json

# 采购订单行索引: 单号 -> (物料编码 -> 行数组)
$poLines = @{}
foreach ($o in $po) {
  $no = [string]$o.'单据编号'
  $map = @{}
  foreach ($l in @($o.detail.items)) {
    $mc = [string]$l.'物料编码'
    if (-not $map.ContainsKey($mc)) { $map[$mc] = @() }
    $map[$mc] += $l
  }
  $poLines[$no] = $map
}

$targets = $pin | Where-Object { [string]$_.'是否已转ERP' -ne '是' -and [string]$_.'单据状态' -eq '已审核' }
$rows = @()
$report = @()
foreach ($d in ($targets | Sort-Object { [string]$_.'单据日期' } -Descending)) {
  $docNo = [string]$d.'单据编号'
  $headPoList = @(([string]$d.'采购订单号') -split '[、,]' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  $i = 0
  foreach ($l in @($d.detail.items)) {
    $i++
    $code = [string]$l.'存货编码'
    $srcNo = [string]$l.'源单编号'
    $srcLine = [string]$l.'采购订单行号'
    $cand = $headPoList
    if ($srcNo) { $cand = @($srcNo -split '[、,]' | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
    $hit = $null; $hitOrder = ''
    foreach ($o in $cand) {
      if ($poLines.ContainsKey($o)) {
        $m = $poLines[$o]
        if ($m.ContainsKey($code)) {
          $lines = $m[$code]
          if ($srcLine) {
            $pick = $lines | Where-Object { ([string]$_.'行号') -eq $srcLine -or ([string]$_.'分录序号') -eq $srcLine } | Select-Object -First 1
            if ($pick) { $hit = $pick; $hitOrder = $o; break }
          }
          if (-not $hit) { $hit = $lines[0]; $hitOrder = $o; break }
        }
      }
    }
    $qty = 0; $in = $null; $un = $null; $closed = ''; $realio = ''
    if ($hit) {
      $qty = [double]$hit.'数量'
      $in = $hit.'金蝶已入库数量'; $un = $hit.'金蝶未入库数量'
      $closed = [string]$hit.'行关闭状态'; $realio = [string]$hit.'行入库状态'
    }
    $docQty = [double]$l.'实收数量'
    $verdict = '未知(订单行未找到)'
    if ($hit) {
      $unN = if ($un -eq $null -or "$un" -eq '') { $null } else { [double]$un }
      if ($unN -ne $null -and $unN -le 0) { $verdict = '已收满 ⇒ 会挡' }
      elseif ($unN -ne $null -and $docQty -gt $unN) { $verdict = '超出未入库量' }
      else { $verdict = '有余额' }
    }
    $report += [pscustomobject]@{
      单据 = $docNo
      行 = $i
      存货编码 = $code
      存货名称 = [string]$l.'存货名称'
      实收数量 = $docQty
      单位 = [string]$l.'计量单位'
      仓库 = [string]$l.'仓库'
      批次号 = [string]$l.'批次号'
      特采 = [string]$l.'特采'
      源单 = $hitOrder
      订单行 = if ($hit) { [string]$hit.'行号' } else { '' }
      订单数量 = $qty
      已入库 = if ($hit) { [string]$in } else { '' }
      未入库 = if ($hit) { [string]$un } else { '' }
      行入库状态 = $realio
      行关闭 = $closed
      判定 = $verdict
    }
  }
}
[System.IO.File]::WriteAllText("D:\YINJIA-main\_scratch\server-analysis.json", (ConvertTo-Json -InputObject $report -Depth 6), $enc)
Write-Output ("lines=" + $report.Count)
$report | ForEach-Object { "{0} 行{1} {2} {3} 收{4}{5} 源[{6}#{7}] 订单{8}/已入{9}/未入{10}/{11} → {12}" -f $_.单据, $_.行, $_.存货编码, $_.存货名称, $_.实收数量, $_.单位, $_.源单, $_.订单行, $_.订单数量, $_.已入库, $_.未入库, $_.判定, '' }
