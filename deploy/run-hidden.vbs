Dim sh, rc, target, fso, base
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
target = "sync.mjs"
If WScript.Arguments.Count > 0 Then target = WScript.Arguments(0)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = base
rc = sh.Run("""C:\Program Files\nodejs\node.exe"" " & target, 0, True)
WScript.Quit rc
