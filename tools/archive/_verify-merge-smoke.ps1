# _verify-merge-smoke.ps1 — 合并后两账套接口冒烟(只读,不写库)2026-10-07
# 覆盖:登录(两工厂) / getPanelConfig / queryFormDataList(实验室记录表:看远端改的日期下发口径) /
#       生产工单列表(本次特性的取数端点) / MATERIAL_OUT 面板配置
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8090'

function Post($path, $body, $tok) {
  $h = @{}
  if ($tok) { $h['Authorization'] = "Bearer $tok" }
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 8))
  try {
    $r = Invoke-WebRequest -Method Post -Uri "$base$path" -Headers $h -ContentType 'application/json; charset=utf-8' -Body $bytes -UseBasicParsing
    return ([System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json)
  } catch {
    $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream(), [System.Text.Encoding]::UTF8)
    return ($sr.ReadToEnd() | ConvertFrom-Json)
  }
}
function Get2($path, $tok) {
  $h = @{ Authorization = "Bearer $tok" }
  try {
    $r = Invoke-WebRequest -Method Get -Uri "$base$path" -Headers $h -UseBasicParsing
    return ([System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json)
  } catch { return [pscustomobject]@{ code = -1; message = $_.Exception.Message } }
}

foreach ($f in @(@{ f = 'YJ'; n = '正式库' }, @{ f = 'YJ_TEST'; n = '测试库' })) {
  Write-Output "########## $($f.n) ($($f.f)) ##########"
  $login = Post '/api/auth/login' @{ userName = 'admin'; password = '123456'; factory = $f.f } $null
  $tok = $login.data.token
  Write-Output "① 登录 code=$($login.code) factory=$($login.data.user.factory)"
  if (-not $tok) { continue }

  $cfg = Get2 '/api/px/getPanelConfig?panelCode=RD_INSTR_USE' $tok
  Write-Output "② RD_INSTR_USE 面板配置 code=$($cfg.code) 字段数=$($cfg.data.fields.Count)"

  $q = Post '/api/px/queryFormDataList' @{ panelCode = 'RD_INSTR_USE'; condition = @{}; pageNo = 1; pageSize = 5 } $tok
  $rows = @($q.data.list)
  Write-Output "③ RD_INSTR_USE 查询 code=$($q.code) 行数=$($rows.Count)"
  if ($rows.Count) {
    # 日期类字段应以 yyyy-MM-dd 文本下发(远端口径);把疑似 ISO 带时区的值挑出来
    $flat = $rows[0].PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }
    $iso = $flat | Where-Object { $_ -match 'T\d{2}:\d{2}:\d{2}' }
    Write-Output "   首行键值样例: " + (($flat | Select-Object -First 6) -join ' | ')
    Write-Output "   带时区 ISO 值(应为 0): $($iso.Count)  $(if ($iso) { $iso -join '; ' })"
  }

  $wol = Post '/api/px/workOrderList' @{ '日期从' = '2026-08-01'; '日期到' = '2026-10-31' } $tok
  Write-Output "④ 生产工单列表 code=$($wol.code) 行数=$($wol.data.Count)"

  $mo = Get2 '/api/px/getPanelConfig?panelCode=MATERIAL_OUT' $tok
  Write-Output "⑤ MATERIAL_OUT 面板配置 code=$($mo.code) 字段数=$($mo.data.fields.Count)"
  Write-Output ''
}

