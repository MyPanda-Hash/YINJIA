Add-Type -Namespace W4 -Name U4 -MemberDefinition '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c); [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);'
$p = Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Output 'no-edge'; exit }
[W4.U4]::ShowWindow($p.MainWindowHandle, 6) | Out-Null
$flip = 0; $prev = $true
1..14 | ForEach-Object { Start-Sleep -Milliseconds 350; $ic = [W4.U4]::IsIconic($p.MainWindowHandle); if ($ic -ne $prev) { $flip++; $prev = $ic } }
Write-Output ("flips=" + $flip + " final=" + $ic)
