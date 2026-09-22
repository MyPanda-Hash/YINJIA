# _win-watch.ps1 — 最小化后窗口事件监控(前台窗口PID/标题 + 所有msedge顶层窗口状态)
Add-Type -Namespace W9 -Name U9 -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
'@
$p = Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Output 'no-edge'; exit 1 }
$h = $p.MainWindowHandle
[W9.U9]::ShowWindow($h, 6) | Out-Null
$prev = ''
1..20 | ForEach-Object {
  Start-Sleep -Milliseconds 400
  $fg = [W9.U9]::GetForegroundWindow()
  $fgpid = 0
  [W9.U9]::GetWindowThreadProcessId($fg, [ref]$fgpid) | Out-Null
  $fgProc = (Get-Process -Id $fgpid -ErrorAction SilentlyContinue).ProcessName
  $iconic = [W9.U9]::IsIconic($h)
  $line = "t=$($_ * 400)ms iconic=$iconic fg=$fgProc($fgpid)"
  if ($line -ne $prev) { Write-Output $line; $prev = $line }
}
