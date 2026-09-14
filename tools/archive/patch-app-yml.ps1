# patch-app-yml.ps1 — application.yml 补测试数据源与工厂名(一次性补丁)
$ErrorActionPreference = "Stop"
$p = "C:\INCER\YINJIA-MES\backend\src\main\resources\application.yml"
$raw = [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8)
if ($raw.Contains('test-datasource')) { Write-Host '已存在,跳过'; exit 0 }
$lines = [System.Collections.Generic.List[string]]($raw -split "`r`n")
if ($lines.Count -lt 50) { $lines = [System.Collections.Generic.List[string]]($raw -split "`n") }
$idx = -1
for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -eq 'yinjia:') { $idx = $i; break } }
if ($idx -lt 0) { throw '未找到 yinjia: 键' }
$insert = [System.Collections.Generic.List[string]]@(
'  # 登录工厂清单显示名(ADR-0003:YJ=正式 HSDZ_MES / YJ_TEST=测试 HSDZ_MES_TEST)',
'  factory-name: "YINJIA-MES"',
'  test-factory-name: "YINJIA-MES·测试库"',
'  test-datasource:',
'    url: jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true;loginTimeout=10',
'    username: yinjia',
'    password: Yinjia@2026')
$lines.InsertRange($idx + 1, [System.Collections.Generic.IEnumerable[string]]$insert)
[IO.File]::WriteAllText($p, ($lines -join "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
Start-Sleep 1
$chk = [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8)
Write-Host ("已插入: " + $chk.Contains('test-datasource'))
