# _win-watch2.ps1 — 精确找到可见的 Edge 主窗口(枚举窗口而非进程句柄),再观测最小化行为
Add-Type -Namespace WA -Name UA -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lp);
public delegate bool EnumProc(IntPtr h, IntPtr lp);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder sb, int max);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
'@
$edgePids = (Get-Process msedge -ErrorAction SilentlyContinue).Id
if (-not $edgePids) { Write-Output 'no-edge'; exit 1 }
$found = [IntPtr]::Zero
$cb = {
  param($h, $lp)
  if ([WA.UA]::IsWindowVisible($h)) {
    $pid2 = 0
    [WA.UA]::GetWindowThreadProcessId($h, [ref]$pid2) | Out-Null
    if ($edgePids -contains [int]$pid2) {
      $sb = New-Object System.Text.StringBuilder 256
      [WA.UA]::GetWindowText($h, $sb, 256) | Out-Null
      if ($sb.ToString().Length -gt 3) { $script:found = $h; return $false }
    }
  }
  return $true
}
[WA.UA]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
if ($found -eq [IntPtr]::Zero) { Write-Output 'no-visible-edge-window'; exit 1 }
Write-Output ("hwnd=" + $found)
[WA.UA]::ShowWindow($found, 6) | Out-Null
$prev = ''
1..20 | ForEach-Object {
  Start-Sleep -Milliseconds 400
  $iconic = [WA.UA]::IsIconic($found)
  $line = "t=$($_ * 400)ms iconic=$iconic"
  if ($line -ne $prev) { Write-Output $line; $prev = $line }
}
