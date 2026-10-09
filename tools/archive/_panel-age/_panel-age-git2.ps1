# _panel-age-git2.ps1 — two-tier last-change evidence per panel. READ-ONLY.
#   Tier A (meta)  : tools/*.sql migrations + db seed  => panel definition changed
#                    (excludes tools/archive probes, tools/gen registers, tools/verify)
#   Tier B (code)  : frontend/src + backend/src/main/java => panel wired in code
#                    (menu entry, sheet config, handlers, buttons)
# NOTE: keep ASCII-only (PS 5.1 reads .ps1 as GBK). Windows has no pwsh.exe here.
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

$pathsA = @('tools', ':(exclude)tools/archive', ':(exclude)tools/gen', ':(exclude)tools/verify', 'db')
$pathsB = @('frontend/src', 'backend/src/main/java')

function LastHit([string]$code, [string[]]$paths) {
  $ga = @('log', '--no-textconv', '-1', '--date=short', '--format=%h|%ad|%s', '--name-only', '-G', "\b$code\b", '--') + $paths
  $raw = @(& git @ga 2>&1)
  $err = @($raw | Where-Object { "$_" -match 'fatal:|signal pipe|\[main\]' }).Count
  $ok = @($raw | Where-Object { "$_" -notmatch 'fatal:|signal pipe|\[main\]' })
  if (-not $ok -or $ok.Count -eq 0) { return [pscustomobject]@{ date = ''; sha = ''; subject = ''; files = ''; err = $err } }
  $hdr = "$($ok[0])"
  if ($hdr -notmatch '^([0-9a-f]{7,})\|(\d{4}-\d{2}-\d{2})\|(.*)$') { return [pscustomobject]@{ date = ''; sha = ''; subject = ''; files = ''; err = $err } }
  $files = @($ok | Select-Object -Skip 2 | Where-Object { "$_".Trim() }) -join ' '
  return [pscustomobject]@{ date = $Matches[2]; sha = $Matches[1]; subject = $Matches[3]; files = $files; err = $err }
}

$rows = New-Object System.Collections.Generic.List[object]
function Probe([string]$code, [string]$group) {
  $a = LastHit $code $pathsA
  $b = LastHit $code $pathsB
  $rows.Add([pscustomobject]@{ code = $code; group = $group
    aDate = $a.date; aSha = $a.sha; aSubject = $a.subject; aFiles = $a.files
    bDate = $b.date; bSha = $b.sha; bSubject = $b.subject; bFiles = $b.files; err = ($a.err + $b.err) })
}
foreach ($c in $qcMenu) { Probe $c 'QC-MENU' }
foreach ($c in $scmMenu) { Probe $c 'SCM-MENU' }

$outFile = Join-Path $root 'tools\archive\_panel-age\_out-git-age2.tsv'
$rows | ForEach-Object { "$($_.code)`t$($_.group)`t$($_.aDate)`t$($_.aSha)`t$($_.aSubject)`t$($_.aFiles)`t$($_.bDate)`t$($_.bSha)`t$($_.bSubject)`t$($_.bFiles)`t$($_.err)" } |
  Set-Content -Path $outFile -Encoding UTF8
Write-Output "panels: $($rows.Count) -> $outFile ; stderr noise total: $(($rows | Measure-Object -Property err -Sum).Sum)"
