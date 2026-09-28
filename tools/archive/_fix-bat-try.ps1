# _fix-bat-try.ps1 — 两个启动 bat 的 :try 子过程换 release 文件判版法(零执行,免 for/f 引号坑)
$enc = [Text.Encoding]::GetEncoding(936)

$p = 'backend\start-backend.bat'
$s = [IO.File]::ReadAllText((Resolve-Path $p), $enc)
$marker = ':try'
$i = $s.IndexOf($marker)
if ($i -ge 0) {
    $s = $s.Substring(0, $i)
    $s += @'
:try
if defined JAVA_EXE goto :eof
if not exist %1 goto :eof
rem 零执行判版:读 JDK 自带 release 文件的 JAVA_VERSION(免 -version 输出解析的 for/f 引号坑)
findstr /b /r /c:"JAVA_VERSION=\"2[5-9]\." "%~dp1..\release" >nul && set "JAVA_EXE=%~f1"
goto :eof
'@
    [IO.File]::WriteAllText((Resolve-Path $p), $s, $enc)
    Write-Output "$p :try 已替换"
} else { Write-Output "$p 未找到 :try" }

$p = 'start-project.bat'
$s = [IO.File]::ReadAllText((Resolve-Path $p), $enc)
$i = $s.IndexOf($marker)
if ($i -ge 0) {
    $s = $s.Substring(0, $i)
    $s += @'
:try
if defined JAVA_HOME_25 goto :eof
if not exist %1 goto :eof
rem 零执行判版:读 JDK 自带 release 文件的 JAVA_VERSION(免 for/f 引号坑);JAVA_HOME_25=bin 上级目录
findstr /b /r /c:"JAVA_VERSION=\"2[5-9]\." "%~dp1..\release" >nul && for %%d in ("%~dp1..") do set "JAVA_HOME_25=%%~fd"
goto :eof
'@
    [IO.File]::WriteAllText((Resolve-Path $p), $s, $enc)
    Write-Output "$p :try 已替换"
} else { Write-Output "$p 未找到 :try" }
