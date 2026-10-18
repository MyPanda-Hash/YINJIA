' run-hidden.vbs - hidden launcher for scheduled tasks: run node sync.mjs in this folder
' (optional first arg overrides the script name).
'
' 2026-10-18 fix: this file used to hardcode "C:\Program Files\nodejs\node.exe", but that path
'   does NOT exist on this machine (node is managed by nvm-windows at C:\nvm4w\nodejs\node.exe).
'   The task therefore failed silently - hidden window, only a non-zero exit code in history.
'   Now it probes the usual install locations and finally falls back to node on PATH.
'   Keep this file ASCII-only: VBScript reads .vbs as ANSI, UTF-8 CJK comments would be mangled.
'
' Usage: wscript.exe run-hidden.vbs [script, default sync.mjs]
Dim sh, rc, target, fso, base, nodeExe, cands, i

Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")

base = fso.GetParentFolderName(WScript.ScriptFullName)
target = "sync.mjs"
If WScript.Arguments.Count > 0 Then target = WScript.Arguments(0)

cands = Array( _
  sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe", _
  "C:\nvm4w\nodejs\node.exe", _
  sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\nodejs\node.exe", _
  sh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\nvs\node.exe", _
  sh.ExpandEnvironmentStrings("%APPDATA%") & "\npm\node.exe" _
)

nodeExe = "node.exe"          ' fallback: whatever node is on PATH
For i = 0 To UBound(cands)
  If fso.FileExists(cands(i)) Then
    nodeExe = cands(i)
    Exit For
  End If
Next

sh.CurrentDirectory = base
rc = sh.Run("""" & nodeExe & """ " & target, 0, True)
WScript.Quit rc
