# compat-http.ps1 —— 验证替身 Invoke-WebRequest 能接住脚本用到的全部参数
$ErrorActionPreference = 'Stop'
. 'D:\YINJIA-main\deploy\print-agent\compat-ps2.ps1' -Force
$r = Invoke-WebRequestCompat -Uri 'http://127.0.0.1:8090/api/auth/login' -Method Post -UseBasicParsing -TimeoutSec 25 `
     -Body ([System.Text.Encoding]::UTF8.GetBytes('{"userName":"admin","password":"123456","factory":"YJ"}')) `
     -ContentType 'application/json; charset=utf-8'
Write-Output ("login status=" + $r.StatusCode + " token_len=" + (([string](ConvertFrom-JsonCompat $r.Content).data.token)).Length)
$h = Invoke-WebRequestCompat -Uri 'http://127.0.0.1:8090/' -UseBasicParsing -TimeoutSec 5
Write-Output ("root status=" + $h.StatusCode + " len=" + $h.Content.Length)
$bad = Invoke-WebRequestCompat -Uri 'http://127.0.0.1:8090/api/nope' -UseBasicParsing -TimeoutSec 5
Write-Output ("404 path status=" + $bad.StatusCode)
Write-Output '[PASS] HTTP 替身参数兼容(UseBasicParsing)'