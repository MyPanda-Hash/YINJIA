# _real-click-min.ps1 — 用 SendInput 真实鼠标点击最小化按钮(最贴近用户操作),观测结果
param([string]$Url = 'http://localhost:8090/#/login', [string]$Tag = 'page')
Add-Type -Namespace WD -Name UD -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lp);
public delegate bool EnumProc(IntPtr h, IntPtr lp);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder sb, int max);
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
public struct RECT { public int L; public int T; public int R; public int B; }
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
'@
Stop-Process -Name msedge -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
$profile = Join-Path $env:TEMP ("yj-rc-" + [guid]::NewGuid().ToString('N').Substring(0,6))
$edge = Start-Process "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ArgumentList '--no-first-run','--window-size=1400,900',"--user-data-dir=$profile", $Url -PassThru
Start-Sleep -Seconds 10
# 找主窗口(有标题的可见 Chrome_WidgetWin_1)
$edgePids = (Get-Process msedge -ErrorAction SilentlyContinue).Id
$main = [IntPtr]::Zero
$cb = {
  param($h, $lp)
  $pid2 = 0
  [WD.UD]::GetWindowThreadProcessId($h, [ref]$pid2) | Out-Null
  if ($edgePids -contains [int]$pid2) {
    $sb = New-Object System.Text.StringBuilder 256; [WD.UD]::GetWindowText($h, $sb, 256) | Out-Null
    if ([WD.UD]::IsWindowVisible($h) -and $sb.ToString().Length -gt 5) { $script:main = $h; return $false }
  }
  return $true
}
[WD.UD]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
if ($main -eq [IntPtr]::Zero) { Write-Output "[$Tag] no main window"; exit 1 }
$r = New-Object WD.UD+RECT
[WD.UD]::GetWindowRect($main, [ref]$r) | Out-Null
# Win11 Edge 最小化按钮:右上角,大约 x=R-60, y=T+18
$x = $r.R - 60; $y = $r.T + 18
# 先把窗口置前
[WD.UD]::SetCursorPos($x, $y) | Out-Null
Start-Sleep -Milliseconds 300
[WD.UD]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)  # down
[WD.UD]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)  # up
Write-Output ("[$Tag] 已点击($x,$y) 观测8秒:")
$prev = ''
1..20 | ForEach-Object {
  Start-Sleep -Milliseconds 400
  $ic = [WD.UD]::IsIconic($main)
  $line = "t=$($_ * 400)ms iconic=$ic"
  if ($line -ne $prev) { Write-Output "  $line"; $prev = $line }
}
Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue
