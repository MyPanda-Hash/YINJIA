# _rdp-run.ps1 - drive keystrokes into a running RDP session (2026-09-21)
#
# WHY: the server only exposes 3389 (RDP) and 8090 (HTTP) - no WinRM/SSH/SMB,
# so ops work has to go through the RDP GUI (see 部署说明.md section 7).
#
# ASCII-ONLY ON PURPOSE (same rule as the .bat files): PowerShell 5.1 reads a
# .ps1 without a BOM as ANSI, so non-ASCII comments/strings become mojibake and
# can even break the parser (hit for real: a Chinese warning string killed it).
#
# Recipe notes (all learned the hard way):
#   * AppActivate returning True does NOT mean the window is in the foreground
#     (Windows foreground lock). Minimize+restore, then verify with GetForegroundWindow.
#   * Win-key combos are swallowed by the local machine -> use Ctrl+Esc for the
#     remote Start menu.
#   * The remote desktop usually has a CHINESE IME active, which eats typed ASCII
#     letters and composes them into Chinese. Never type long text: put it on the
#     clipboard and send Ctrl+V (clipboard redirection).
#   * Never type blindly: prefer commands whose side effects can be verified from
#     the dev machine (logs written into the redirected drive \\tsclient\C\...).
#
# Usage:
#   powershell -File tools/archive/_rdp-run.ps1 -Keys '^v'
#   powershell -File tools/archive/_rdp-run.ps1 -Keys '{ENTER}'
#   powershell -File tools/archive/_rdp-run.ps1 -Command '<cmdline>'   # opens a cmd first
param(
  [string]$Command,
  [string]$Keys,
  [int]$SettleSeconds = 6,
  [switch]$NoNewConsole,
  [switch]$ClickCenter          # click the middle of the RDP window first (gives the remote session focus)
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -Namespace Rdp -Name Win -MemberDefinition @'
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, IntPtr e);
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
'@

$m = Get-Process mstsc -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $m) { throw 'mstsc is not running - connect to the server RDP first' }
$h = $m.MainWindowHandle
if ($h -eq [IntPtr]::Zero) { throw 'no mstsc window handle yet (session still connecting?)' }

(New-Object -ComObject WScript.Shell).AppActivate($m.Id) | Out-Null
Start-Sleep -Milliseconds 700
if ([Rdp.Win]::GetForegroundWindow() -ne $h) {
  [Rdp.Win]::ShowWindow($h, 6) | Out-Null    # minimize
  Start-Sleep -Milliseconds 400
  [Rdp.Win]::ShowWindow($h, 9) | Out-Null    # restore
  Start-Sleep -Milliseconds 400
  [Rdp.Win]::SetForegroundWindow($h) | Out-Null
  Start-Sleep -Milliseconds 700
}
$fg = [Rdp.Win]::GetForegroundWindow()
Write-Host ("mstsc pid={0} hwnd={1} foreground={2} match={3}" -f $m.Id, $h, $fg, ($fg -eq $h))
if ($fg -ne $h) { Write-Warning 'mstsc is NOT in the foreground - keystrokes may go elsewhere' }

if ($ClickCenter) {
  $r = New-Object Rdp.Win+RECT
  [Rdp.Win]::GetWindowRect($h, [ref]$r) | Out-Null
  $cx = [int](($r.Left + $r.Right) / 2)
  $cy = [int](($r.Top + $r.Bottom) / 2)
  [Rdp.Win]::SetCursorPos($cx, $cy) | Out-Null
  Start-Sleep -Milliseconds 300
  [Rdp.Win]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero)   # left down
  [Rdp.Win]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero)   # left up
  Start-Sleep -Milliseconds 800
  Write-Host ("clicked center of rdp window at {0},{1}" -f $cx, $cy)
}

if ($Keys) {
  [System.Windows.Forms.SendKeys]::SendWait($Keys)
  Write-Host ("sent keys: {0}" -f $Keys)
  Start-Sleep -Seconds $SettleSeconds
  Write-Host ("waited {0}s" -f $SettleSeconds)
  exit 0
}
if (-not $Command) { throw 'pass either -Keys or -Command' }

if (-not $NoNewConsole) {
  [System.Windows.Forms.SendKeys]::SendWait('^{ESC}'); Start-Sleep -Seconds 3
  [System.Windows.Forms.SendKeys]::SendWait('cmd');     Start-Sleep -Seconds 3
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Start-Sleep -Seconds 5
}
[System.Windows.Forms.SendKeys]::SendWait($Command); Start-Sleep -Seconds 1
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Write-Host ("sent: {0}" -f $Command)
Start-Sleep -Seconds $SettleSeconds
Write-Host ("waited {0}s" -f $SettleSeconds)
