# fetch-loop.ps1 -- retry git fetch over the local FlClash proxy (7890) until it lands.
# ASCII only on purpose: Windows PowerShell 5.1 reads a BOM-less file as ANSI and would
# choke on any Chinese characters (2026-11-18 first run hit exactly that).
param([int]$Attempts = 8)
$ErrorActionPreference = 'Continue'
Set-Location 'D:\YINJIA-main'
$log = 'D:\YINJIA-main\tools\archive\_qc-rec-resultcols-20261119\git-fetch-loop.log'
function L($m) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m
  Add-Content -Path $log -Encoding UTF8 -Value $line
  Write-Host $line
}
"=== fetch-loop start $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Set-Content -Path $log -Encoding UTF8
$target = '4225b0aca82ecbce15166f967993ee5e5e472aab'
for ($i = 1; $i -le $Attempts; $i++) {
  $transport = if ($i % 2 -eq 1) { 'http' } else { 'socks5h' }
  $proxy = if ($transport -eq 'http') { 'http://127.0.0.1:7890' } else { 'socks5h://127.0.0.1:7890' }
  L ("attempt {0}/{1} via {2}" -f $i, $Attempts, $transport)
  $out = & git -c "http.proxy=$proxy" -c http.version=HTTP/1.1 -c http.lowSpeedLimit=2000 -c http.lowSpeedTime=45 `
    fetch --no-tags --progress origin "+refs/heads/main:refs/remotes/origin/main" 2>&1
  $rc = $LASTEXITCODE
  ($out | Select-Object -Last 3) | ForEach-Object { L ("   " + ($_ -replace '\s+$', '')) }
  L ("   rc=$rc")
  if ($rc -eq 0) {
    $head = (& git rev-parse origin/main).Trim()
    L ("fetch OK, origin/main=$head")
    if ($head -eq $target) { L 'matches ls-remote tip 4225b0aca'; break }
    L ("WARN: ls-remote tip is $target")
  }
  Start-Sleep -Seconds 3
}
$behind = (& git rev-list --count HEAD..origin/main)
$tip = (& git rev-parse --short origin/main)
L ("end: behind=$behind origin/main=$tip")
