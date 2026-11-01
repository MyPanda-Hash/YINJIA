# 激活 ZCode 窗口:还原→最大化→置前→校验(修复 IAB 截图 surface 准备超时)
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class WAct {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  public struct RECT { public int L, T, R, B; }
}
'@
$p = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.ProcessName -eq 'ZCode' } | Select-Object -First 1
if (-not $p) { Write-Output 'NO_WINDOW'; exit 1 }
$h = $p.MainWindowHandle
[WAct]::ShowWindow($h, 9) | Out-Null    # SW_RESTORE
Start-Sleep -Milliseconds 300
[WAct]::ShowWindow($h, 3) | Out-Null    # SW_MAXIMIZE
Start-Sleep -Milliseconds 300
[WAct]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 500
$r = New-Object WAct+RECT
[WAct]::GetWindowRect($h, [ref]$r) | Out-Null
$fg = [WAct]::GetForegroundWindow()
Write-Output ("handle=$h rect=$(($r.R-$r.L))x$(($r.B-$r.T)) at $($r.L),$($r.T) foreground=" + ($fg -eq $h))
