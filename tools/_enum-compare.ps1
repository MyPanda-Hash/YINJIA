# _enum-compare.ps1 — 对比不同页面上 Edge 的 owned 可见弹窗是否出现
param([string]$Url = 'http://localhost:8090/#/login', [string]$Tag = 'page')
Add-Type -Namespace WC -Name UC -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lp);
public delegate bool EnumProc(IntPtr h, IntPtr lp);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
[DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder sb, int max);
[DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, System.Text.StringBuilder sb, int max);
[DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint rel);
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
public struct RECT { public int L; public int T; public int R; public int B; }
'@
Stop-Process -Name msedge -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
$profile = Join-Path $env:TEMP ("yj-cmp-" + [guid]::NewGuid().ToString('N').Substring(0,6))
Start-Process "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ArgumentList '--no-first-run','--window-size=1400,900',"--user-data-dir=$profile", $Url | Out-Null
Start-Sleep -Seconds 9
$edgePids = (Get-Process msedge -ErrorAction SilentlyContinue).Id
$rows = New-Object System.Collections.ArrayList
$cb = {
  param($h, $lp)
  $pid2 = 0
  [WC.UC]::GetWindowThreadProcessId($h, [ref]$pid2) | Out-Null
  if ($edgePids -contains [int]$pid2) {
    $sb = New-Object System.Text.StringBuilder 256; [WC.UC]::GetWindowText($h, $sb, 256) | Out-Null
    $cn = New-Object System.Text.StringBuilder 256; [WC.UC]::GetClassName($h, $cn, 256) | Out-Null
    $r = New-Object WC.UC+RECT
    [WC.UC]::GetWindowRect($h, [ref]$r) | Out-Null
    $rows.Add(@{ H = $h; Class = $cn.ToString(); Vis = [WC.UC]::IsWindowVisible($h); Owner = [WC.UC]::GetWindow($h, 4); Title = $sb.ToString(); Rect = "$($r.L),$($r.T) $($r.R -$r.L)x$($r.B -$r.T)" }) | Out-Null
  }
  return $true
}
[WC.UC]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
$owned = $rows | Where-Object { $_.Owner -ne [IntPtr]::Zero -and $_.Vis }
Write-Output ("[$Tag] owned可见弹窗数=" + (@($owned).Count) + "  详情:" + (@($owned | ForEach-Object { "$($_.Class)@[$($_.Rect)]" }) -join ' | '))
Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue
