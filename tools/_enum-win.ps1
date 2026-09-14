# _enum-win.ps1 — 枚举 Edge 进程的全部顶层窗口(含不可见),列类名/标题/可见性/owned关系
param([switch]$Minimize)
Add-Type -Namespace WB -Name UB -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lp);
public delegate bool EnumProc(IntPtr h, IntPtr lp);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder sb, int max);
[DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, System.Text.StringBuilder sb, int max);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
[DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint rel);
'@
$edgePids = (Get-Process msedge -ErrorAction SilentlyContinue).Id
$rows = New-Object System.Collections.ArrayList
$cb = {
  param($h, $lp)
  $pid2 = 0
  [WB.UB]::GetWindowThreadProcessId($h, [ref]$pid2) | Out-Null
  if ($edgePids -contains [int]$pid2) {
    $sb = New-Object System.Text.StringBuilder 256; [WB.UB]::GetWindowText($h, $sb, 256) | Out-Null
    $cn = New-Object System.Text.StringBuilder 256; [WB.UB]::GetClassName($h, $cn, 256) | Out-Null
    $owner = [WB.UB]::GetWindow($h, 4)  # GW_OWNER
    $rows.Add(@{ H = $h; Pid = $pid2; Class = $cn.ToString(); Title = $sb.ToString(); Vis = [WB.UB]::IsWindowVisible($h); Iconic = [WB.UB]::IsIconic($h); Owner = $owner }) | Out-Null
  }
  return $true
}
[WB.UB]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
$rows | ForEach-Object { "{0} pid={1} class={2} vis={3} iconic={4} owner={5} title={6}" -f $_.H, $_.Pid, $_.Class, $_.Vis, $_.Iconic, $_.Owner, $_.Title }
if ($Minimize) {
  $main = $rows | Where-Object { $_.Class -eq 'Chrome_WidgetWin_1' -and $_.Vis -and $_.Title } | Select-Object -First 1
  if ($main) {
    Write-Output ("-- ShowWindow(6) on " + $main.H)
    [WB.UB]::ShowWindow($main.H, 6) | Out-Null
    Start-Sleep -Milliseconds 800
    $rows2 = New-Object System.Collections.ArrayList
    $cb2 = {
      param($h, $lp)
      $pid2 = 0
      [WB.UB]::GetWindowThreadProcessId($h, [ref]$pid2) | Out-Null
      if ($edgePids -contains [int]$pid2) {
        $sb = New-Object System.Text.StringBuilder 256; [WB.UB]::GetWindowText($h, $sb, 256) | Out-Null
        $cn = New-Object System.Text.StringBuilder 256; [WB.UB]::GetClassName($h, $cn, 256) | Out-Null
        $rows2.Add(@{ H = $h; Class = $cn.ToString(); Title = $sb.ToString(); Vis = [WB.UB]::IsWindowVisible($h); Iconic = [WB.UB]::IsIconic($h) }) | Out-Null
      }
      return $true
    }
    [WB.UB]::EnumWindows($cb2, [IntPtr]::Zero) | Out-Null
    Write-Output '-- 最小化后窗口清单 --'
    $rows2 | ForEach-Object { "{0} class={1} vis={2} iconic={3} title={4}" -f $_.H, $_.Class, $_.Vis, $_.Iconic, $_.Title }
  }
}
