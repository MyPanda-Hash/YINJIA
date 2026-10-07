# _verify-toPicking-guards.ps1 — 转领料单守卫用例(2026-10-07)
# 覆盖:① 占用链(已在 _verify-toPicking.ps1 验过)② 存量未审核领料单 ③ 已结案 ④ 排产数量 0
# ⚠ 只在**测试账套 HSDZ_MES_TEST** 上造数(③④需要临时改 plang.ja / pl_sl),跑完自动还原。
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File tools\archive\_verify-toPicking-guards.ps1
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8090'
$java = 'C:\Users\vigna\.jdks\ms-25.0.4\bin\java.exe'
$jar = 'D:\workspace\yinjia\tools\lib\mssql-jdbc.jar'
$runner = 'D:\workspace\yinjia\tools\SqlRunner.java'
$testUrl = 'jdbc:sqlserver://localhost:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true'

function Sql($file) {
  # 口令优先取环境变量(与 tools/SqlRunner.java / DbSync 同一约定),未设时退回本机开发库口令
  $pass = if ($env:YINJIA_SQL_PASS) { $env:YINJIA_SQL_PASS } else { 'Yinjia@2026' }
  & $java '-Dfile.encoding=UTF-8' '-Dstdout.encoding=UTF-8' -cp $jar $runner $testUrl yinjia $pass $file 2>&1 | Out-Null
}

function Post($path, $body, $tok) {
  $headers = @{}
  if ($tok) { $headers['Authorization'] = "Bearer $tok" }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 8))
  try {
    $resp = Invoke-WebRequest -Method Post -Uri "$base$path" -Headers $headers `
      -ContentType 'application/json; charset=utf-8' -Body $bytes -UseBasicParsing
    $text = [System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
  } catch {
    $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream(), [System.Text.Encoding]::UTF8)
    $text = $sr.ReadToEnd()
  }
  return ($text | ConvertFrom-Json)
}

function Payload($no, $xc, $batch) {
  return , @(@{ '公司代码' = '0'; '工单号' = $no; '工单行号' = $xc; '批次号' = $batch })
}

$login = Post '/api/auth/login' @{ userName = 'admin'; password = '123456'; factory = 'YJ_TEST' } $null
$tok = $login.data.token
Write-Output "① 登录测试账套 OK"

# ---- 用例②:存量未审核领料单兜底(MO-2026-09-0006 名下已有草稿 LL2609280001)----
$r2 = Post '/api/px/workOrderList/toPicking' @{ rows = (Payload 'MO-2026-09-0006' 1 '20260928') } $tok
Write-Output "② 存量未审核领料单守卫: code=$($r2.code) msg=$($r2.message)"

# ---- 用例③:已结案不给转 ----
Sql 'D:\workspace\yinjia\tools\archive\_t-guard-ja-y.sql'
$r3 = Post '/api/px/workOrderList/toPicking' @{ rows = (Payload 'MO-2026-09-0108' 1 '20260928') } $tok
Write-Output "③ 已结案守卫: code=$($r3.code) msg=$($r3.message)"

# ---- 用例④:排产数量 0(未排产)不给转 ----
Sql 'D:\workspace\yinjia\tools\archive\_t-guard-plsl0.sql'
$r4 = Post '/api/px/workOrderList/toPicking' @{ rows = (Payload 'MO-2026-09-0108' 1 '20260928') } $tok
Write-Output "④ 未排产守卫: code=$($r4.code) msg=$($r4.message)"

# ---- 还原测试账套原值 ----
Sql 'D:\workspace\yinjia\tools\archive\_t-guard-restore.sql'
Write-Output "⑤ 测试账套已还原(MO-2026-09-0108:ja=N,pl_sl=100)"

