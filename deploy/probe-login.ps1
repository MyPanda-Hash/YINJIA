# probe-login.ps1 - prove the application is REALLY usable (ASCII-only output).
#
# Why not a health check: Tomcat starts listening BEFORE its DB cache warms up,
# so the first requests can return 200 (a false positive); then the DB round-trip
# fails, context refresh fails and the process exits -> "connection refused" outside.
# Only POST /api/auth/login (which reads yj_user) returning a token proves it works.
#
# Output (parsed by deploy-all.bat):
#   LOGIN-OK      token issued
#   NO-TOKEN      endpoint answered but no token (wrong account or wrong DB)
#   HTTP-<code>   endpoint answered with a non-200 status
#   FAIL          could not connect (app not up yet)
#
# NOTE: this file is intentionally ASCII-only, like the .bat files. PowerShell 5.1
# reads .ps1 as ANSI when there is no BOM, so non-ASCII comments would be mojibake.
param(
  [string]$Url = 'http://localhost:8090/api/auth/login',
  [string]$User = 'admin',
  [string]$Pass = '123456',
  [int]$TimeoutSec = 8
)
$ErrorActionPreference = 'Stop'
try {
  $body = @{ userName = $User; password = $Pass } | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Uri $Url -Method Post -ContentType 'application/json' -Body $body -TimeoutSec $TimeoutSec
  if ($r.data.token) {
    Write-Output 'LOGIN-OK'
  } elseif ($r.data.detail) {
    Write-Output 'FAIL'
  } else {
    Write-Output 'NO-TOKEN'
  }
} catch {
  $resp = $null
  try { $resp = $_.Exception.Response } catch { }
  if ($resp -and $resp.StatusCode) {
    Write-Output ('HTTP-' + [int]$resp.StatusCode)
  } else {
    Write-Output 'FAIL'
  }
}
