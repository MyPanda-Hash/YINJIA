# _minimize-hang.ps1 — 真实最小化诊断:ShowWindow 模拟点击最小化,量化渲染进程 CPU 与 JS 主线程响应
# 用法: .\_minimize-hang.ps1 <URL> [标签]   例: .\_minimize-hang.ps1 http://localhost:5173/#/panelx/list/RD_PROGRESS 进度查询
param(
  [string]$Url = 'http://localhost:8090/#/dashboard',
  [string]$Label = 'page',
  [int]$Port = 9373
)
$ErrorActionPreference = 'Continue'
Add-Type -Namespace Win -Name U -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
[DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
'@
$login = Invoke-RestMethod -Method Post -Uri ($Url.Split('#')[0].TrimEnd('/') + '/api/auth/login') -ContentType 'application/json' -Body '{"userName":"admin","password":"123456"}'
$token = $login.data.token
$userJson = ($login.data.user | ConvertTo-Json -Compress).Replace("'", "''")

$profile = Join-Path $env:TEMP ("yj-min-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
$edge = Start-Process -FilePath "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ArgumentList @(
  '--no-first-run', '--window-size=1400,900',
  "--remote-debugging-port=$Port", "--user-data-dir=$profile", 'about:blank'
) -PassThru
Start-Sleep -Seconds 3
try {
  $tab = (Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:$Port/json/new?about:blank")
  # WebSocket via .NET ClientWebSocket
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [System.Threading.CancellationToken]::None
  $ws.ConnectAsync([Uri]$tab.webSocketDebuggerUrl, $ct).Wait()
  $global:seq = 0
  $script:results = @{}
  function Send-Eval($expr) {
    $global:seq++
    $id = $global:seq
    $msg = @{ id = $id; method = 'Runtime.evaluate'; params = @{ expression = $expr; returnByValue = $true; awaitPromise = $true } } | ConvertTo-Json -Depth 6 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($msg)
    $ws.SendAsync([ArraySegment[byte]]::new($bytes), 'Text', $true, $ct).Wait()
    # 读帧直到 id 匹配(简化:单连接单请求)
    $buf = New-Object byte[] (4MB)
    while ($true) {
      $ms = New-Object System.IO.MemoryStream
      do {
        $seg = [ArraySegment[byte]]::new($buf)
        $r = $ws.ReceiveAsync($seg, $ct).Result
        $ms.Write($buf, 0, $r.Count)
      } while (-not $r.EndOfMessage)
      $text = [Text.Encoding]::UTF8.GetString($ms.ToArray())
      try { $j = $text | ConvertFrom-Json } catch { continue }
      if ($j.id -eq $id) { return $j.result.result.value }
    }
  }
  function CpuOf($name) {
    (Get-Process -Name $name -ErrorAction SilentlyContinue | Measure-Object CPU -Sum).Sum
  }
  # 登录态注入
  $userJson = ($login.data.user | ConvertTo-Json -Compress).Replace("'", "`u{2019}")
  Send-Eval "localStorage.setItem('mes_token', '$token'); localStorage.setItem('mes_user', '$userJson'); 'ok'" | Out-Null
  Send-Eval "location.href='$Url'" | Out-Null
  Start-Sleep -Seconds 5
  $cpuBefore = CpuOf 'edge'
  $t0 = [DateTime]::Now
  # 最小化(模拟点最小化按钮)
  $hwnd = $edge.MainWindowHandle
  # 两种方式都试:SC_MINIMIZE(等价点最小化按钮)+ ShowWindow
  [Win.U]::SendMessage($hwnd, 0x0112, [IntPtr]0xF020, [IntPtr]::Zero) | Out-Null  # WM_SYSCOMMAND+SC_MINIMIZE
  Start-Sleep -Milliseconds 600
  $iconicSys = [Win.U]::IsIconic($hwnd)
  if (-not $iconicSys) { [Win.U]::ShowWindow($hwnd, 6) | Out-Null }
  Start-Sleep -Seconds 1
  $iconic = [Win.U]::IsIconic($hwnd)
  Start-Sleep -Seconds 3
  $cpuAfter = CpuOf 'edge'
  $dt = ([DateTime]::Now - $t0).TotalSeconds
  $cpuDelta = [math]::Round(($cpuAfter - $cpuBefore) / $dt, 2)
  # 主线程响应:两次 performance.now 间隔(冻结时会显著拖长/超时)
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $resp = Send-Eval "1+1"
  $sw.Stop()
  "[$Label] IsIconic=$iconic | Edge CPU 最小化后 3s ≈ $cpuDelta% | JS响应=${($sw.ElapsedMilliseconds)}ms (resp=$resp)"
  [Win.U]::ShowWindow($hwnd, 9) | Out-Null  # SW_RESTORE
  Start-Sleep -Milliseconds 800
} finally {
  try { $edge | Stop-Process -Force -ErrorAction SilentlyContinue } catch {}
  Start-Sleep -Milliseconds 800
  try { Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue } catch {}
}
