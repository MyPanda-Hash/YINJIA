# _panel-age-git.ps1 — per-panel "last changed" forensics for the two modules
#   Quality (QC menu) + Smart SCM (SCM menu). READ-ONLY.
# Method: git pickaxe (-G with word boundary) per panel code; newest commit that
#   changed a line containing that code = "last touched". Pathspec excludes
#   tools/archive (probe artifacts) and docs, keeping only assets that really
#   define a panel: tools/*.sql migrations, frontend/src, backend java, db, deploy.
# NOTE: keep this file ASCII-only (Windows PowerShell 5.1 reads .ps1 as GBK).
# Usage: . .\tools\archive\_panel-age\_panel-age-git.ps1
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = 'D:\YINJIA-main'
Set-Location $root

$qcMenu = @('QC_INSP','QC_TC_IN','QC_CATALOG','QC_INSP_REC','QC_INSP_REQ','QC_INSP_REQ_SERIES',
            'QC_OP','QC_RECORD','QC_DISPOSAL','ROD_RETURN','LOT_TRACE',
            'QC_BHG','QC_BHC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY')
$scmMenu = @('SO_ORDER','SALES_ORDER_DETAIL','SALES_ORDER_STATS','PU_REQ','PU_ORDER',
             'QC_RECV','QC_RETURN','PURCHASE_IN','FINISH_IN','OTHER_IN','OUTSOURCE_IN','SALE_OUT',
             'MATERIAL_OUT','OTHER_OUT','OUTSOURCE_ISSUE',
             'PURCHASE_IN_DETAIL','FINISH_IN_DETAIL','OTHER_IN_DETAIL','OUTSOURCE_IN_DETAIL',
             'SALE_OUT_DETAIL','MATERIAL_OUT_DETAIL','OTHER_OUT_DETAIL','OUTSOURCE_ISSUE_DETAIL',
             'PURCHASE_IN_STATS','FINISH_IN_STATS','OTHER_IN_STATS','OUTSOURCE_IN_STATS',
             'SALE_OUT_STATS','MATERIAL_OUT_STATS','OTHER_OUT_STATS','OUTSOURCE_ISSUE_STATS',
             'STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY')

$paths = @('tools', ':(exclude)tools/archive', 'frontend/src', 'backend/src/main/java', 'backend/src/main/resources/mapper', 'db', 'deploy')

$rows = New-Object System.Collections.Generic.List[object]
function Probe([string]$code, [string]$group) {
  $ga = @('log', '--no-textconv', '--date=short', '--format=%h|%ad|%s', '--name-only', '-G', "\b$code\b", '--') + $paths
  $raw = & git @ga 2>&1
  $errs = @($raw | Where-Object { "$_" -match 'fatal:|signal pipe|\[main\]' })
  $out = @($raw | Where-Object { "$_" -notmatch 'fatal:|signal pipe|\[main\]' })
  $commits = @()
  if ($out) {
    $cur = $null
    foreach ($line in $out) {
      $s = "$line"
      if ($s -match '^([0-9a-f]{7,})\|(\d{4}-\d{2}-\d{2})\|(.*)$') {
        if ($cur) { $commits += $cur }
        $cur = [pscustomobject]@{ sha = $Matches[1]; date = $Matches[2]; subject = $Matches[3]; files = @() }
      } elseif ($cur -and $s.Trim()) {
        $cur.files += $s.Trim()
      }
    }
    if ($cur) { $commits += $cur }
  }
  $n = $commits.Count
  $errc = $errs.Count
  if ($n -eq 0) {
    $rows.Add([pscustomobject]@{ code = $code; group = $group; last = '2026-08-31'; sha = 'NO-HIT'; subject = 'no change since initial import'; files = ''; hits = 0; second = ''; errs = $errc })
  } else {
    $c = $commits[0]
    $sec = if ($n -gt 1) { "$($commits[1].date) $($commits[1].subject)" } else { '' }
    $rows.Add([pscustomobject]@{ code = $code; group = $group; last = $c.date; sha = $c.sha; subject = $c.subject; files = ($c.files -join ' '); hits = $n; second = $sec; errs = $errc })
  }
}

foreach ($c in $qcMenu) { Probe $c 'QC-MENU' }
foreach ($c in $scmMenu) { Probe $c 'SCM-MENU' }

$outFile = Join-Path $root 'tools\archive\_panel-age\_out-git-age.tsv'
$rows | ForEach-Object { "$($_.code)`t$($_.group)`t$($_.last)`t$($_.sha)`t$($_.subject)`t$($_.hits)`t$($_.files)`t$($_.second)`t$($_.errs)" } |
  Set-Content -Path $outFile -Encoding UTF8
Write-Output "panels: $($rows.Count) -> $outFile"
Write-Output "panels with git stderr noise: $(@($rows | Where-Object { $_.errs -gt 0 }).Count)"
$rows | Group-Object { $_.last.Substring(0,7) } | Sort-Object Name | ForEach-Object { "$($_.Name)`t$($_.Count)" }
