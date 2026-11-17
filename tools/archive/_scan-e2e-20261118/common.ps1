# common.ps1 — 手机扫码全流程自测的公共件(登录 + 调接口 + 记结果)
#   用法: . .\common.ps1 ; $ctx = Connect-YjTest ; Api 'GET' '/api/px/mix/lines?orderNo=GD-2026-11-0010'
$ErrorActionPreference = 'Stop'
$script:Base = 'http://127.0.0.1:8090'
$script:Dir  = $PSScriptRoot
$script:Results = @()

function Write-Json($obj, $name) {
  $p = Join-Path $script:Dir $name
  $json = $obj | ConvertTo-Json -Depth 12
  [System.IO.File]::WriteAllText($p, $json, (New-Object System.Text.UTF8Encoding($false)))
  return $p
}

function Connect-YjTest {
  $body = '{"userName":"admin","password":"123456","factory":"YJ_TEST"}'
  $r = Api 'POST' '/api/auth/login' $body $null
  if ($r.Code -ne 200) { throw "登录失败: $($r.Message)" }
  Write-Host ("登录成功 factory={0} user={1}" -f $r.Data.user.factory, $r.Data.user.userName)
  return $r.Data.token
}

function Api {
  param(
    [string]$Method,
    [string]$Path,
    [string]$BodyJson,
    [string]$Token
  )
  $id = [guid]::NewGuid().ToString('N')
  $req = Join-Path $script:Dir "_req_$id.json"
  $res = Join-Path $script:Dir "_res_$id.json"
  $cargs = @('-s', '-X', $Method, "$script:Base$Path", '-o', $res)
  if ($Token) { $cargs += @('-H', "Authorization: Bearer $Token") }
  if ($BodyJson) {
    [System.IO.File]::WriteAllText($req, $BodyJson, (New-Object System.Text.UTF8Encoding($false)))
    $cargs += @('-H', 'Content-Type: application/json', '--data-binary', "@$req")
  }
  & curl.exe @cargs 2>$null | Out-Null
  $raw = ''
  if (Test-Path $res) { $raw = [System.IO.File]::ReadAllText($res, [System.Text.Encoding]::UTF8) }
  Remove-Item $req, $res -Force -ErrorAction SilentlyContinue
  $obj = $null
  try { if ($raw) { $obj = $raw | ConvertFrom-Json } } catch { }
  if ($obj) {
    # 两种返回形态都要认:
    #   ① ApiResult 包封 {code,message,data}(/mobilePick/*、/slip/*、/callButton);
    #   ② 裸 Map(MixScanController 的 /mix/* 就是这种,没有 code/data)⇒ 整个 JSON 当 data。
    if ($obj.PSObject.Properties['code']) {
      return [pscustomobject]@{ Code = $obj.code; Message = $obj.message; Data = $obj.data; Raw = $raw }
    }
    return [pscustomobject]@{ Code = 200; Message = 'ok(裸对象)'; Data = $obj; Raw = $raw }
  }
  $short = if ($raw.Length -gt 400) { $raw.Substring(0, 400) } else { $raw }
  return [pscustomobject]@{ Code = -1; Message = "非 JSON 响应: $short"; Data = $null; Raw = $raw }
}

# 记录一条检查结果;OK 为真则 PASS,否则 FAIL(打印原因)
function Check {
  param([string]$Name, [bool]$Ok, [string]$Detail = '')
  $tag = if ($Ok) { 'PASS' } else { 'FAIL' }
  $color = if ($Ok) { 'Green' } else { 'Red' }
  Write-Host ("[{0}] {1}{2}" -f $tag, $Name, $(if ($Detail) { " — $Detail" } else { '' })) -ForegroundColor $color
  $script:Results += [pscustomobject]@{ Name = $Name; Ok = $Ok; Detail = $Detail }
}

# 记录一条「已知问题」:不算失败(套件仍绿),但会汇总到报告里
function Warn {
  param([string]$Name, [string]$Detail = '')
  Write-Host ("[WARN] {0}{1}" -f $Name, $(if ($Detail) { " — $Detail" } else { '' })) -ForegroundColor Yellow
  $script:Results += [pscustomobject]@{ Name = ('WARN ' + $Name); Ok = $true; Detail = $Detail }
}

function Summary {
  param([string]$Title)
  $fail = @($script:Results | Where-Object { -not $_.Ok })
  Write-Host ''
  Write-Host ("==== {0}: {1} 项,通过 {2},失败 {3} ====" -f $Title, $script:Results.Count,
    ($script:Results.Count - $fail.Count), $fail.Count) -ForegroundColor $(if ($fail.Count) { 'Red' } else { 'Green' })
  foreach ($f in $fail) { Write-Host ("  FAIL: {0} — {1}" -f $f.Name, $f.Detail) -ForegroundColor Red }
  Write-Json $script:Results ("result-" + $Title + ".json") | Out-Null
  if ($fail.Count) { exit 1 }
}

# 取对象属性(路径不存在返回 $null,不抛)
function V($obj, [string]$Name) {
  if ($obj -eq $null) { return $null }
  $p = $obj.PSObject.Properties[$Name]
  if ($p) { return $p.Value }
  return $null
}

# 把对象压成 JSON 字符串(请求体用;非 ASCII 会转 \uXXXX,服务端照旧解析)
function J($obj) { return ($obj | ConvertTo-Json -Depth 12 -Compress) }

# 今天(本地日期,yyyy-MM-dd)
function Today() { return (Get-Date).ToString('yyyy-MM-dd') }

# 取数组属性(不存在/为空一律返回空数组)。
# ⚠ 两个坑都踩过:① @(V $x 'y') 在属性缺失时会得到 [null]、Count=1;
#   ② 直接 `return @($v)` 会被 PowerShell 展开 —— 接口只返回 1 行时调用方拿到的是**单个对象**,
#   它的 .Count 是 $null。所以这里用逗号运算符原样返回数组,不展开。
function Arr($obj, [string]$Name) {
  $v = V $obj $Name
  if ($null -eq $v) { return ,@() }
  return ,@($v)
}
