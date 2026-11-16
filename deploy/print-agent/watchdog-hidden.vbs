' watchdog-hidden.vbs - hidden launcher for the print-agent watchdog (2026-11-16)
'
' The scheduled task "YinjiaMesPrintAgent-Watch" runs this file every minute;
' it starts watchdog.ps1 with no console window.
' Why not use "powershell.exe -WindowStyle Hidden" as the task action directly:
'   that flashes a console window on every run (1440 times a day on the customer
'   PC); wscript starts the child with no window at all.
'
' Keep this file pure ASCII: VBScript reads .vbs as ANSI, so UTF-8 CJK comments
' would be mangled (and can break parsing).
Dim sh, fso, base, ps, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

base = fso.GetParentFolderName(WScript.ScriptFullName)
ps = sh.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"
If Not fso.FileExists(ps) Then ps = "powershell.exe"

cmd = """" & ps & """ -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & base & "\watchdog.ps1"""
If WScript.Arguments.Count > 0 Then cmd = cmd & " " & WScript.Arguments(0)

sh.CurrentDirectory = base
sh.Run cmd, 0, True
