# 品质监控接口口径核对(测试账套):新字段 不合格品处理单号/不合格品处理状态/特采 是否返回
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8090'
$tmp = Join-Path $env:TEMP ('yj-qcflow-' + [guid]::NewGuid().ToString('N') + '.json')

[System.IO.File]::WriteAllText($tmp, '{"userName":"admin","password":"123456","factory":"YJ_TEST"}', (New-Object System.Text.UTF8Encoding $false))
$login = (& curl.exe -s -X POST "$base/api/auth/login" -H 'Content-Type: application/json' -d "@$tmp") | ConvertFrom-Json
$token = $login.data.token
[System.IO.File]::WriteAllText($tmp, '{"状态":"全部","仅未检验":false,"显示已隐藏":false}', (New-Object System.Text.UTF8Encoding $false))
$raw = & curl.exe -s -X POST "$base/api/px/qcFlow/list" -H 'Content-Type: application/json' -H "Authorization: Bearer $token" -d "@$tmp"
Remove-Item $tmp -ErrorAction SilentlyContinue
$r = $raw | ConvertFrom-Json
Write-Host "code=$($r.code) rows=$($r.data.rows.Count)"
$hit = $r.data.rows | Where-Object { $_.'检验单号' -eq 'IJ-2026-11-0007' } | Select-Object -First 1
if (-not $hit) { Write-Host '未找到 IJ-2026-11-0007 的行'; exit 1 }
Write-Host ("行: 检验单号={0} 不合格数量={1} 特采={2} 不合格品处理单号={3} 不合格品处理状态={4} 当前环节={5} 入库单号={6} 入库状态={7}" -f `
  $hit.'检验单号', $hit.'不合格数量', $hit.'特采', $hit.'不合格品处理单号', $hit.'不合格品处理状态', $hit.'当前环节', $hit.'入库单号', $hit.'入库状态')
Write-Host "汇总: $($r.data.summary | ConvertTo-Json -Compress)"
Write-Host "字段存在性: 不合格品处理单号=$($hit.PSObject.Properties.Name -contains '不合格品处理单号') 待不合格品处理汇总=$(($r.data.summary.PSObject.Properties.Name -contains '待不合格品处理'))"
