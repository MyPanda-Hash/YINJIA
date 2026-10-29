' hindsight-follow-dsh.vbs — 让 hindsight 跟着 DeepSeek Harness 启停(2026-10-25)
'
' 用户口径:「取消开机自启动,改为打开 DeepSeek Harness 再启动,关闭 DeepSeek Harness 就停止」
'
' 为什么用 VBS 而不是 PowerShell:
'   这是长期常驻的看门程序,内存越省越好。wscript 常驻约 5~35 MB,同功能 PowerShell 要 60~90 MB。
'
' 判定口径(实测修正过,别改回去):
'   · DSH:WMI 查 Name='DeepSeek Harness.exe'。它同时有 gpu/renderer 子进程同名,
'     但主窗口退出后它们会一起退,所以"存在任一"等价于"DSH 开着"。
'   · hindsight:**HTTP 探 /docs**,不用 Get-NetTCPConnection。
'     2026-10-25 实测:服务 HTTP 200 正常时,Get-NetTCPConnection -State Listen 却返回空
'     (端口 State 为空),用它判断会让看门程序误判"已停止"并反复重启。
'   · 停:taskkill /IM hindsight-api.exe /T /F。**不用 `daemon stop`** ——
'     实测该命令报 "Could not find PID for port 9077" 且杀不掉(服务照跑)。
'
' ? 2026-10-25 修过的两个坑(改回来会重新出现"每 25 秒反复启停"):
'   ① 状态必须**每轮重新读**:启动后先 Sleep 等模型加载,醒来后不能再拿 Sleep 前的 dsh 值
'      去判"DSH 已退出",否则一睡醒就误停掉刚起的服务。→ 现在判定前一律重读。
'   ② HTTP 探测不能阻塞循环:MSXML2.XMLHTTP 一旦连不上会卡到系统默认超时(几十秒),
'      期间看门程序像死了一样。→ 用 ServerXMLHTTP 并显式设 2 秒超时,失败即判 down。
'
' 参数:
'   (无)          常驻看护循环
'   --test-stop   只执行"停止"分支(自检用)

Option Explicit

Const PORT = 9077
Const EMBED = "C:\Users\x1787\.local\bin\hindsight-embed.exe"
Const PROFILE = "coding-agent"
Const LOGFILE = "C:\Users\x1787\.dsh\logs\hindsight-follow-dsh.log"
Const POLL_MS = 5000
Const START_WAIT_MS = 25000
' 开机宽限期:开机后 DSH 可能比本看门程序晚几十秒才起来(两者都在启动文件夹/自启里,
' 顺序不保证)。若一开机就判"DSH 不在且服务不在"然后退出,当天就再也没人拉起 hindsight 了。
' 所以:启动后前 GRACE_MS 内即使两边都不在也不退出,只继续等。
Const GRACE_MS = 240000

Dim fso, sh, testStop
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
testStop = False
If WScript.Arguments.Count > 0 Then
  If LCase(WScript.Arguments(0)) = "--test-stop" Then testStop = True
End If

Sub Log(msg)
  On Error Resume Next
  Dim f
  Set f = fso.OpenTextFile(LOGFILE, 8, True)
  f.WriteLine "[" & Now & "] " & msg
  f.Close
  On Error GoTo 0
End Sub

' DSH 是否在跑(每次调用都重新查,不复用旧值)
Function DshRunning()
  Dim svc, col, p
  DshRunning = False
  On Error Resume Next
  Set svc = GetObject("winmgmts:\\.\root\cimv2")
  Set col = svc.ExecQuery("SELECT ProcessId FROM Win32_Process WHERE Name='DeepSeek Harness.exe'")
  If Not col Is Nothing Then
    For Each p In col
      DshRunning = True
      Exit For
    Next
  End If
  On Error GoTo 0
End Function

' hindsight 是否健康(2 秒硬超时,绝不阻塞看护循环)
Function HindsightUp()
  Dim http
  HindsightUp = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 2000, 2000, 2000, 2000
  http.Open "GET", "http://127.0.0.1:" & PORT & "/docs", False
  http.Send
  If Err.Number = 0 Then
    If http.Status >= 200 And http.Status < 500 Then HindsightUp = True
  End If
  Err.Clear
  On Error GoTo 0
End Function

Sub StartHindsight()
  Log "start: hindsight-embed daemon start"
  On Error Resume Next
  sh.Run """" & EMBED & """ -p " & PROFILE & " daemon start", 0, False
  On Error GoTo 0
End Sub

Sub StopHindsight()
  Log "stop: taskkill /IM hindsight-api.exe /T /F"
  On Error Resume Next
  sh.Run "cmd /c taskkill /IM hindsight-api.exe /T /F", 0, True
  sh.Run "cmd /c taskkill /IM uvx.exe /F", 0, True
  On Error GoTo 0
End Sub

If testStop Then
  Log "=== test-stop ==="
  StopHindsight
  WScript.Sleep 4000
  Log "test-stop: up=" & CStr(HindsightUp())
  WScript.Quit 0
End If

Log "=== watcher started (port=" & PORT & ", poll=" & (POLL_MS \ 1000) & "s) ==="

Dim startedAt
startedAt = Timer

Do
  Dim dsh, up
  dsh = DshRunning()
  up = HindsightUp()

  If dsh Then
    If Not up Then
      Log "DSH running, hindsight down -> starting"
      StartHindsight
      WScript.Sleep START_WAIT_MS
      ' 醒来后**重新判定**,不拿 Sleep 前的值下结论(见文件头坑①)
    End If
  Else
    If up Then
      Log "DSH gone, hindsight still up -> stopping"
      StopHindsight
      WScript.Sleep 4000
    Else
      ' 开机宽限期内继续等 DSH 起来,别过早退出
      If Timer < GRACE_MS / 1000 Then
        ' 仍在宽限期(开机后 4 分钟内),静默等待
      Else
        Log "DSH gone and hindsight down -> watcher exits"
        Exit Do
      End If
    End If
  End If

  WScript.Sleep POLL_MS
Loop

Log "=== watcher exited ==="
