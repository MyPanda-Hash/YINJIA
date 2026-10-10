# _panel-age-first.ps1 — first-seen (creation) commit per panel for the stale candidates.
# ASCII-only (PS 5.1 GBK source reading). READ-ONLY.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location 'D:\YINJIA-main'
$codes = @('QC_OP','QC_RECORD','QC_DISPOSAL','ROD_RETURN','LOT_TRACE',
           'SALES_ORDER_DETAIL','SALES_ORDER_STATS',
           'PURCHASE_IN_DETAIL','FINISH_IN_DETAIL','OTHER_IN_DETAIL','OUTSOURCE_IN_DETAIL',
           'SALE_OUT_DETAIL','MATERIAL_OUT_DETAIL','OTHER_OUT_DETAIL','OUTSOURCE_ISSUE_DETAIL',
           'PURCHASE_IN_STATS','FINISH_IN_STATS','OTHER_IN_STATS','OUTSOURCE_IN_STATS',
           'SALE_OUT_STATS','MATERIAL_OUT_STATS','OTHER_OUT_STATS','OUTSOURCE_ISSUE_STATS',
           'STOCK_BALANCE','STOCK_SUMMARY')
$paths = @('tools', ':(exclude)tools/archive', ':(exclude)tools/gen', ':(exclude)tools/verify', 'db', 'frontend/src', 'backend/src/main/java')
$out = @()
foreach ($c in $codes) {
  $ga = @('log', '--no-textconv', '--reverse', '--date=short', '--format=%h|%ad|%s', '--name-only', '-G', "\b$c\b", '--') + $paths
  $raw = @(& git @ga 2>&1) | Where-Object { "$_" -notmatch 'fatal:|signal pipe|\[main\]' }
  $first = if ($raw.Count -ge 1) { "$($raw[0])" } else { 'NO-HIT' }
  $file = if ($raw.Count -ge 3) { "$($raw[2])".Trim() } else { '' }
  $out += "$c`t$first`t$file"
}
$f = 'tools\archive\_panel-age\_out-git-first.tsv'
$out | Set-Content -Path $f -Encoding UTF8
Write-Output "-> $f"
$out | ForEach-Object { $_ }
