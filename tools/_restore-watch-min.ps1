# _restore-watch-min.ps1 — 仅负责最小化真实 Edge 窗口(配 _restore-watch.cjs 的页面监控)
param([int]$DelayMs = 2000)
Add-Type -Namespace W3 -Name U3 -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
'@
Start-Sleep -Milliseconds $DelayMs
$p = Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Host 'no edge window'; exit 1 }
[W3.U3]::ShowWindow($p.MainWindowHandle, 6) | Out-Null
Start-Sleep -Milliseconds 600
Write-Host "minimized (IsIconic=$([W3.U3]::IsIconic($p.MainWindowHandle)))"
