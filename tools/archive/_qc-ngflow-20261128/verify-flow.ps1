# 不合格分支改道后的端到端验证(测试账套 HSDZ_MES_TEST)
# 覆盖:检验数据记录判不合格 → 审批通过自动生成不合格品处理单 → 处理单两级审批通过 → 回填检验行特采
#       → 检验单审核按特采分流入库(让步接收)。每一步都打印取证,失败即抛错。
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8090'
$tmp = Join-Path $env:TEMP ('yj-verify-' + [guid]::NewGuid().ToString('N') + '.json')

function Post-Json([string]$path, [string]$json, [string]$token) {
    [System.IO.File]::WriteAllText($tmp, $json, (New-Object System.Text.UTF8Encoding $false))
    $args = @('-s', '-X', 'POST', "$base$path", '-H', 'Content-Type: application/json', '-d', "@$tmp")
    if ($token) { $args += @('-H', "Authorization: Bearer $token") }
    $raw = & curl.exe @args
    if (-not $raw) { throw "空响应: $path" }
    return $raw | ConvertFrom-Json
}

function Call-Button([string]$panel, [string]$button, $formData, [string]$token) {
    $body = @{ panelCode = $panel; buttonName = $button; formData = $formData; buttonParam = @{} } | ConvertTo-Json -Depth 8 -Compress
    return Post-Json '/api/px/callButton' $body $token
}

# ---- ① 登录测试账套 ----
$login = Post-Json '/api/auth/login' '{"userName":"admin","password":"123456","factory":"YJ_TEST"}' ''
if ($login.code -ne 200) { throw "登录失败: $($login | ConvertTo-Json -Depth 4)" }
$token = $login.data.token
$factory = $login.data.user.factory
Write-Host "[1] 登录 OK factory=$factory tokenLen=$($token.Length)"

# ---- ② 检验数据记录:提交审批 + 审批通过 ----
$rec = @{ '编号' = 'JYSJ-2026-11-0021' }
$r1 = Call-Button 'QC_INSP_REC' '提交审批' $rec $token
Write-Host "[2] 提交审批 code=$($r1.code) msg=$($r1.msg)"
if ($r1.code -ne 200) { throw "提交审批失败: $($r1 | ConvertTo-Json -Depth 4)" }
$r2 = Call-Button 'QC_INSP_REC' '审批通过' ($rec + @{ '审批意见' = '验证:不合格自动生成处理单' }) $token
Write-Host "[3] 审批通过 code=$($r2.code) msg=$($r2.msg) status=$($r2.data.'状态')"
if ($r2.code -ne 200) { throw "审批通过失败: $($r2 | ConvertTo-Json -Depth 4)" }

# ---- ③ 处理单:提交审批 → 一级 → 二级(管理员) ----
# 单号从库里取(按钮返回的是 {编号,状态},不含链路回填列;而"回填"本身正是待验证的东西)
$javaExe = if ($env:JAVA_HOME) { "$env:JAVA_HOME\bin\java.exe" } else { 'java' }
$tools = 'D:\YINJIA-main\tools'
$qout = & $javaExe '-Dstdout.encoding=UTF-8' -cp "$tools\lib\mssql-jdbc.jar" `
    "$tools\archive\_qc-ngflow-20261128\_Q.java" "$tools\archive\_qc-ngflow-20261128\q-rec-ng.sql" 'HSDZ_MES_TEST' 2>&1
$ngNo = [string]($qout | Where-Object { $_ -notmatch '^\s*$' } | Select-Object -Skip 1 -First 1)
$ngNo = $ngNo.Trim()
Write-Host "[4] 自动生成并回填的不合格品处理单号 = '$ngNo'"
if (-not $ngNo -or $ngNo -eq '<null>') { throw '审批通过后没有回填不合格品处理单号(自动生单没跑)' }
$tc = @{ '编号' = $ngNo }
$t1 = Call-Button 'QC_TC_IN' '提交审批' $tc $token
Write-Host "[5] 处理单提交审批 code=$($t1.code) msg=$($t1.msg)"
if ($t1.code -ne 200) { throw "处理单提交失败: $($t1 | ConvertTo-Json -Depth 4)" }
$t2 = Call-Button 'QC_TC_IN' '审批通过' ($tc + @{ '审批意见' = '一级同意让步接收' }) $token
Write-Host "[6] 处理单一级审批 code=$($t2.code) msg=$($t2.msg) status=$($t2.data.'状态')"
if ($t2.code -ne 200) { throw "处理单一级审批失败: $($t2 | ConvertTo-Json -Depth 4)" }
$t3 = Call-Button 'QC_TC_IN' '审批通过' ($tc + @{ '审批意见' = '二级批准' }) $token
Write-Host "[7] 处理单二级批准 code=$($t3.code) msg=$($t3.msg) status=$($t3.data.'状态')"
if ($t3.code -ne 200) { throw "处理单二级批准失败: $($t3 | ConvertTo-Json -Depth 4)" }

# ---- ④ 来料检验单:审核 → 按特采分流 ----
$ins = @{ '编号' = 'IJ-2026-11-0007' }
$i1 = Call-Button 'QC_INSP' '审核' $ins $token
Write-Host "[8] 检验单审核 code=$($i1.code) msg=$($i1.msg) status=$($i1.data.'状态')"
if ($i1.code -ne 200) { throw "检验单审核失败: $($i1 | ConvertTo-Json -Depth 4)" }

Write-Host "[9] NG_NO=$ngNo"
Remove-Item $tmp -ErrorAction SilentlyContinue
