 test-compat.ps1 —— 在 PS5 上强制加载 PS2 兼容层,验证 JSON / HTTP 两条路(2026-11-10)
# 用法:powershell -NoProfile -ExecutionPolicy Bypass -File test-compat.ps1
$ErrorActionPreference = 'Stop'
$dir = 'D:\YINJIA-main\deploy\print-agent'
. (Join-Path $dir 'compat-ps2.ps1') -Force

Write-Output '--- 1) JSON 序列化(登录体) ---'
$body = @{ userName = 'admin'; password = '123456'; factory = 'YJ' }
$json = ConvertTo-JsonCompat -InputObject $body -Compress
Write-Output $json

Write-Output '--- 2) HTTP POST 登录 + 解析 token ---'
$r = Invoke-WebRequestCompat -Uri 'http://127.0.0.1:8090/api/auth/login' -Method Post `
     -Body ([System.Text.Encoding]::UTF8.GetBytes($json)) `
     -ContentType 'application/json; charset=utf-8' -TimeoutSec 25
$txt = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
$obj = ConvertFrom-JsonCompat $txt
Write-Output ("status=" + $r.StatusCode + " token_len=" + ([string]$obj.data.token).Length)

Write-Output '--- 3) HTTP GET /health ---'
$h = Invoke-WebRequestCompat -Uri 'http://127.0.0.1:8090/actuator/health' -TimeoutSec 5
Write-Output ("health status=" + $h.StatusCode + " body=" + $h.Content.Substring(0, [Math]::Min(60, $h.Content.Length)))

Write-Output '--- 4) 中文键 JSON 解析(代理轮询的关键) ---'
$sample = '{"ok":true,"task":{"二维码内容":"0@A@1","工单号":"WO-1","工单行号":3,"rows":[{"物料名称":"折叠棉","数量":10}]}}'
$o = ConvertFrom-JsonCompat $sample
Write-Output ("qr=" + $o.task.'二维码内容' + " wo=" + $o.task.'工单号' + " rows=" + @($o.task.rows).Count + " 物料=" + $o.task.rows[0].'物料名称' + " 数量=" + $o.task.rows[0].'数量')

Write-Output '--- 5) 404 也能拿到响应体 ---'
$bad = Invoke-WebRequestCompat -Uri 'http://127.0.0.1:8090/api/not-exist-xyz' -TimeoutSec 5
Write-Output ("status=" + $bad.StatusCode + " len=" + $bad.Content.Length)

Write-Output '[PASS] compat 兼容层验证通过'
