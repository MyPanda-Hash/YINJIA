# push-loop.ps1 -- push local main to origin/main through the FlClash proxy, retrying.
# ASCII only (Windows PowerShell 5.1 reads BOM-less files as ANSI).
param([int]$Attempts = 6)
$ErrorActionPreference = 'Continue'
Set-Location 'D:\YINJIA-main'
$log = 'D:\YINJIA-main\tools\archive\_qc-rec-resultcols-20261119\git-push-loop.log'
function L($m) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m
  Add-Content -Path $log -Encoding UTF8 -Value $line
  Write-Host $line
}
"=== push-loop start $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Set-Content -Path $log -Encoding UTF8
for ($i = 1; $i -le $Attempts; $i++) {
  $transport = if ($i % 2 -eq 1) { 'socks5h' } else { 'http' }
  $proxy = if ($transport -eq 'http') { 'http://127.0.0.1:7890' } else { 'socks5h://127.0.0.1:7890' }
  L ("push attempt {0}/{1} via {2}" -f $i, $Attempts, $transport)
  $out = & git -c "http.proxy=$proxy" -c http.version=HTTP/1.1 -c http.postBuffer=1048576000 -c http.lowSpeedLimit=2000 -c http.lowSpeedTime=60 `
    push --progress origin main 2>&1
  $rc = $LASTEXITCODE
  ($out | Select-Object -Last 6) | ForEach-Object { L ("   " + ($_ -replace '\s+$', '')) }
  L ("   rc=$rc")
  if ($rc -eq 0) { L 'push OK'; break }
  Start-Sleep -Seconds 5
}
$tip = (& git rev-parse --short HEAD)
$remote = (& git rev-parse --short origin/main 2>$null)
L ("end: HEAD=$tip origin/main=$remote")
