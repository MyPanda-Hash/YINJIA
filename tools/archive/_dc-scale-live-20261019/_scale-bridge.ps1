<#
  _scale-bridge.ps1 — 真实电子秤接入 MES 数采的串口桥(2026-10-19)

  现场设备:天翊/JIANKUN 计价电子秤 DZ-06(100kg/10g,蚌埠鸿海工业科技)。
  这类秤的输出口是 RS232(DB9)或蓝牙 SPP,持续吐 ASCII 帧,典型:
    "ST,GS,+  0.520kg\r\n"   /  "wn+00.520kg\r\n"  /  "US,GS,  0.520kg\r\n"
  本脚本把串口字节流里的读数抽出来,走现役接口 POST /api/dc/ingest 写进数采流水。

  三种模式:
    -Sniff             只读串口、原样打印字节(第一次接线用它确认波特率/帧格式,不写库)
    -Com COM3 -Baud 9600   正常上报:抽重量 → /api/dc/ingest(带 X-DC-Key)
    -Simulate          不接串口,用假帧走完整解析+上报链路(验证 MES 侧通不通)

  用法(仓库根):
    powershell -ExecutionPolicy Bypass -File tools\archive\_dc-scale-live-20261019\_scale-bridge.ps1 -Sniff -Com COM3
    powershell -ExecutionPolicy Bypass -File tools\archive\_dc-scale-live-20261019\_scale-bridge.ps1 -Com COM3 -Baud 9600
    powershell -ExecutionPolicy Bypass -File tools\archive\_dc-scale-live-20261019\_scale-bridge.ps1 -Simulate
#>
[CmdletBinding()]
param(
  [string]$Com = 'COM3',
  [int]$Baud = 9600,
  [ValidateSet('None', 'Odd', 'Even')][string]$Parity = 'None',
  [switch]$Sniff,
  [switch]$Simulate,
  [string]$Base = 'http://127.0.0.1:8090',
  [string]$DeviceCode = 'DZ-001',
  [string]$PointCode = 'W01',
  [string]$ApiKey = 'scale-demo-2026',
  [int]$StableSeconds = 2,
  [double]$MinChange = 0.005
)
$ErrorActionPreference = 'Stop'

function Get-FrameWeight([string]$frame) {
  # 抽第一个带小数点(或整数)的重量数字;忽略 ST/US/OL 等状态字和 "kg" 单位
  $m = [regex]::Match($frame, '([+-]?\s*\d{1,4}\.\d{1,3})')
  if (-not $m.Success) {
    $m = [regex]::Match($frame, '(?<=[,\s])([+-]?\d{1,4})(?=\s*(kg|KG|g|G)?\s*$)')
  }
  if (-not $m.Success) { return $null }
  $v = ($m.Groups[1].Value -replace '\s', '')
  return [double]::Parse($v, [Globalization.CultureInfo]::InvariantCulture)
}

function Send-Weight([double]$w, [string]$at = $null) {
  $body = @{ deviceCode = $DeviceCode; values = @(@{ pointCode = $PointCode; value = $w }) }
  if ($at) { $body.values[0].at = $at }
  $json = $body | ConvertTo-Json -Depth 6 -Compress
  try {
    $r = Invoke-RestMethod -Uri "$Base/api/dc/ingest" -Method Post -ContentType 'application/json' `
      -Headers @{ 'X-DC-Key' = $ApiKey } -Body $json -TimeoutSec 5
    return $r
  } catch {
    $msg = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $msg = $_.ErrorDetails.Message }
    throw "上报失败:$msg"
  }
}

if ($Simulate) {
  Write-Host '[simulate] 不接串口,用真实秤的三种典型帧跑解析 + 上报链路'
  $frames = @('ST,GS,+  0.520kg', 'wn+00.520kg', 'US,GS,  0.520kg ', 'ST,GS,+012.340kg', 'OL,GS,+  0.000kg')
  foreach ($f in $frames) {
    $w = Get-FrameWeight $f
    if ($null -eq $w) { Write-Host ("  解析失败 {0}" -f $f); continue }
    $res = Send-Weight $w
    Write-Host ("  {0,-22} -> {1} kg  上报 accepted={2}" -f $f.Trim(), $w, $res.data.accepted)
  }
  return
}

if ($Sniff) {
  Write-Host "[sniff] 打开 $Com @ $Baud 8$($Parity.Substring(0,1))1,原样打印 15 秒(Ctrl+C 提前结束)"
  $port = New-Object System.IO.Ports.SerialPort($Com, $Baud, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)
  if ($Parity -ne 'None') { $port.Parity = [System.IO.Ports.Parity]::$Parity }
  $port.ReadTimeout = 1500
  $port.Open()
  $deadline = (Get-Date).AddSeconds(15)
  $buf = New-Object System.Text.StringBuilder
  try {
    while ((Get-Date) -lt $deadline) {
      try { $chunk = $port.ReadExisting() } catch { $chunk = '' }
      if ($chunk) { [void]$buf.Append($chunk); Write-Host -NoNewline $chunk }
      Start-Sleep -Milliseconds 120
    }
  } finally {
    $port.Close(); $port.Dispose()
  }
  $raw = $buf.ToString()
  Write-Host "`n[sniff] 收到 $($raw.Length) 字符"
  if ($raw.Length -gt 0) {
    $sample = ($raw -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -First 5)
    Write-Host '[sniff] 前 5 帧:'; $sample | ForEach-Object { Write-Host ("  [{0}]" -f ($_ -replace '\p{C}', '.')) }
    Write-Host ("[sniff] 首帧解析重量 = {0}" -f (Get-FrameWeight $sample[-1]))
  } else {
    Write-Host '[sniff] 一个字节都没收到:检查波特率(常见 9600/4800/2400)、线序(2-3-5 交叉)、秤是否设为连续输出'
  }
  return
}

Write-Host "[live] $Com @ $Baud 8$($Parity.Substring(0,1))1 → $Base  ($DeviceCode/$PointCode, 稳定 $StableSeconds 秒且变化 ≥ $MinChange kg 才上报)"
$port = New-Object System.IO.Ports.SerialPort($Com, $Baud, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)
if ($Parity -ne 'None') { $port.Parity = [System.IO.Ports.Parity]::$Parity }
$port.ReadTimeout = 1500
$port.Open()
$last = $null
$lastChange = Get-Date
$sent = 0
try {
  while ($true) {
    $chunk = ''
    try { $chunk = $port.ReadExisting() } catch { }
    if (-not $chunk) { Start-Sleep -Milliseconds 150; continue }
    foreach ($line in ($chunk -split "`r?`n")) {
      if (-not $line.Trim()) { continue }
      $w = Get-FrameWeight $line
      if ($null -eq $w) { continue }
      if ($null -eq $last -or [math]::Abs($w - $last) -ge $MinChange) {
        $last = $w; $lastChange = Get-Date
      } elseif (((Get-Date) - $lastChange).TotalSeconds -ge $StableSeconds) {
        try {
          $null = Send-Weight $w
          $sent++
          Write-Host ("  {0}  稳定 {1,7:N3} kg  已上报(累计 {2})" -f (Get-Date).ToString('HH:mm:ss'), $w, $sent)
        } catch {
          Write-Host ("  {0}  上报异常:{1}" -f (Get-Date).ToString('HH:mm:ss'), $_.Exception.Message) -ForegroundColor Yellow
        }
        $lastChange = (Get-Date).AddHours(24)  # 同一读数只报一次,数值变化后再报
      }
    }
    Start-Sleep -Milliseconds 120
  }
} finally {
  $port.Close(); $port.Dispose()
}
