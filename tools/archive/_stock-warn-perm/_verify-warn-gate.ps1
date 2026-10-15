<#
  _verify-warn-gate.ps1 — 权限闸门实测(2026-10-15 库存预警配置权):
    · 负例:普通账号 cp(有 STOCK_DETAIL 可见、无 warn 词)两个写入口都该 403;
    · 正例:admin 过闸门(故意给空/不存在的键 —— 只到业务校验就返回,不写任何数据)。

  用法(仓库根,脚本含中文须 UTF-8 BOM):powershell -ExecutionPolicy Bypass -File tools\archive\_stock-warn-perm\_verify-warn-gate.ps1
  前置:8090 在跑,且该实例包含 warn 词改动。
#>
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:8090'
$dir = $PSScriptRoot

function Write-Utf8NoBom([string]$path, [string]$text) {
  [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
}
function Login([string]$user) {
  $f = Join-Path $dir "_login-$user.json"
  Write-Utf8NoBom $f "{`"userName`":`"$user`",`"password`":`"123456`"}"
  $r = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -ContentType 'application/json; charset=utf-8' `
    -InFile $f
  return @{ token = $r.data.token; warnPanels = ($r.data.user.warnPanels -join ','); isAdmin = $r.data.user.isAdmin }
}
function Post([string]$path, [string]$token, [string]$bodyFile) {
  $f = Join-Path $dir $bodyFile
  $out = & curl.exe -s -o (Join-Path $dir '_resp.txt') -w '%{http_code}' -X POST "$base$path" `
    -H "Content-Type: application/json; charset=utf-8" -H "Authorization: Bearer $token" --data-binary "@$f"
  $body = Get-Content (Join-Path $dir '_resp.txt') -Raw -Encoding UTF8
  return @{ code = $out; body = $body }
}

$cp = Login 'cp'
$admin = Login 'admin'
Write-Host "cp    : isAdmin=$($cp.isAdmin) warnPanels=[$($cp.warnPanels)]"
Write-Host "admin : isAdmin=$($admin.isAdmin) warnPanels=[$($admin.warnPanels)]"

# 负例 1:库存明细按批次设置(StockWarnController /set → requireWarnConfig)
Write-Utf8NoBom (Join-Path $dir '_body-set.json') '{"wzdm":"","ckdm":"","lot":"","qty":0,"panel":"STOCK_DETAIL"}'
# 负例 2:库存状况行内编辑「更新预警数量」(px/callButton → BUTTON_PERMS warn)
Write-Utf8NoBom (Join-Path $dir '_body-btn.json') '{"panelCode":"STOCK_STATUS","buttonName":"更新预警数量","formData":{"id":"999999999","预警数量":"1"},"buttonParam":{}}'

foreach ($who in @(@{ n = 'cp'; t = $cp.token }, @{ n = 'admin'; t = $admin.token })) {
  $r1 = Post '/api/stock/warn/set' $who.t '_body-set.json'
  Write-Host "[$($who.n)] POST /api/stock/warn/set        -> HTTP $($r1.code)  $($r1.body)"
  $r2 = Post '/api/px/callButton' $who.t '_body-btn.json'
  Write-Host "[$($who.n)] POST /api/px/callButton(更新预警数量) -> HTTP $($r2.code)  $($r2.body)"
}
