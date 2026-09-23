# _kill-backend-tree.ps1 — 停掉后端自愈循环(cmd)+java(8090),防重建时 jar 被锁
$conn = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $conn) { Write-Output '8090 no listener'; exit }
$javaPid = $conn.OwningProcess
$proc = Get-CimInstance Win32_Process -Filter "ProcessId=$javaPid"
$parent = $proc.ParentProcessId
Write-Output "java=$javaPid parent=$parent ($($proc.Name))"
# 先杀父(cmd 循环窗口)整树,再兜底杀 java
if ($parent) { taskkill /PID $parent /T /F 2>&1 | Out-Null }
taskkill /PID $javaPid /T /F 2>&1 | Out-Null
Start-Sleep -Seconds 2
if (Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue) { Write-Output 'STILL LISTENING!' } else { Write-Output '8090 stopped' }
