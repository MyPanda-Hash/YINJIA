# _rewrite-bats.ps1 - rewrite four launcher/build scripts: DYNAMIC JDK discovery (no hardcoded paths)
# Probe order: JAVA_HOME(version-gated) -> scan %USERPROFILE%\.jdks\* -> scan C:\Program Files\Java\* -> scan D:\Program Files\Java\*
# Gate: candidate accepted only when its JDK release file declares major >= 25 (jar is class 69).
# bat comments in English only (GBK second-byte low-ASCII chars tear cmd lines, 2026-09-24 proven).
$enc = [Text.Encoding]::GetEncoding(936)

$probeBE = @'
rem ---- JDK discovery: JAVA_HOME (version-gated) -> scan JDK dirs, accept first with major >= 25 ----
rem jar is class file 69 (pom java.version=25); JDK 23/24 fails with UnsupportedClassVersionError.
rem 2026-09-24: JAVA_HOME pointed to .jdks\openjdk-23.0.1 and old hardcoded-path logic crashed.
rem No hardcoded JDK names: every dir under .jdks / Program Files\Java is tried via its release file.
set "JAVA_EXE="
if defined JAVA_HOME call :TRYJDK "%JAVA_HOME%\bin\java.exe"
if not defined JAVA_EXE for /d %%D in ("%USERPROFILE%\.jdks\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_EXE for /d %%D in ("C:\Program Files\Java\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_EXE for /d %%D in ("D:\Program Files\Java\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_EXE (
  echo [ERROR] JDK 25+ not found ^(pom java.version=25; install one under .jdks or Program Files\Java^)
  pause
  exit /b 1
)
echo [YINJIA-MES] backend 8090 starting with %JAVA_EXE%
'@

$probeSP = @'
rem ---- JDK discovery: JAVA_HOME (version-gated) -> scan JDK dirs, accept first with major >= 25 ----
rem 2026-09-24: JAVA_HOME=openjdk-23.0.1 accepted blindly by old hardcoded-path logic -> class 69 crash.
set "JAVA_HOME_25="
if defined JAVA_HOME call :TRYJDK "%JAVA_HOME%\bin\java.exe"
if not defined JAVA_HOME_25 for /d %%D in ("%USERPROFILE%\.jdks\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_HOME_25 for /d %%D in ("C:\Program Files\Java\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_HOME_25 for /d %%D in ("D:\Program Files\Java\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_HOME_25 (
  echo [ERROR] JDK 25+ not found ^(pom java.version=25; install one under .jdks or Program Files\Java^)
  goto :fail
)
for %%i in ("%JAVA_HOME_25%") do set "JAVA_HOME=%%~dpi"
set "JAVA_HOME=%JAVA_HOME:~0,-1%"
'@

$probeBL = @'
rem ---- JDK discovery: JAVA_HOME (version-gated) -> scan JDK dirs, accept first with major >= 25 ----
rem jar is class 69; JDK 23/24 crashes (2026-09-24: JAVA_HOME=openjdk-23.0.1 accepted blindly).
set "JAVA_HOME_25="
if defined JAVA_HOME call :TRYJDK "%JAVA_HOME%\bin\java.exe"
if not defined JAVA_HOME_25 for /d %%D in ("%USERPROFILE%\.jdks\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_HOME_25 for /d %%D in ("C:\Program Files\Java\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_HOME_25 for /d %%D in ("D:\Program Files\Java\*") do call :TRYJDK "%%~fD\bin\java.exe"
if not defined JAVA_HOME_25 (
  echo [ERROR] JDK 25+ not found ^(pom java.version=25; install one under .jdks or Program Files\Java^)
  exit /b 1
)
for %%i in ("%JAVA_HOME_25%") do set "JAVA_HOME=%%~dpi"
set "JAVA_HOME=%JAVA_HOME:~0,-1%"
'@

$tryBE = @'

rem ---- subroutine: accept candidate java only when its JDK release declares major >= 25 ----
:TRYJDK
if defined JAVA_EXE goto :eof
if not exist %1 goto :eof
findstr /b /r /c:"JAVA_VERSION=.2[5-9]\." "%~dp1..\release" >nul && set "JAVA_EXE=%~f1"
goto :eof
'@

$trySP = @'

rem ---- subroutine: accept candidate java only when its JDK release declares major >= 25 ----
:TRYJDK
if defined JAVA_HOME_25 goto :eof
if not exist %1 goto :eof
findstr /b /r /c:"JAVA_VERSION=.2[5-9]\." "%~dp1..\release" >nul && for %%d in ("%~dp1..") do set "JAVA_HOME_25=%%~fd"
goto :eof
'@

# 1) backend/start-backend.bat : replace probe block (between "cd /d %~dp0.." and ":loop") and tail subroutine
$p = 'backend\start-backend.bat'
$s = [IO.File]::ReadAllText((Resolve-Path $p), $enc)
$i = $s.IndexOf('rem ---- JDK'); $j = $s.IndexOf(':loop')
$k = $s.IndexOf(':TRYJDK')
if ($i -ge 0 -and $j -gt $i) {
    if ($k -lt 0) { $k = $s.Length }
    $s = $s.Substring(0, $i) + $probeBE + "`r`n" + $s.Substring($j, $k - $j) + $tryBE
    [IO.File]::WriteAllText((Resolve-Path $p), $s, $enc); Write-Output "$p OK"
} else { Write-Output "$p SKIP" }

# 2) start-project.bat : probe block (between setlocal and jar check) + tail subroutine
$p = 'start-project.bat'
$s = [IO.File]::ReadAllText((Resolve-Path $p), $enc)
$i = $s.IndexOf('rem ---- JDK'); $j = $s.IndexOf('if not exist "%~dp0backend\target')
$k = $s.IndexOf(':TRYJDK')
if ($i -ge 0 -and $j -gt $i) {
    if ($k -lt 0) { $k = $s.Length }
    $s = $s.Substring(0, $i) + $probeSP + "`r`n" + $s.Substring($j, $k - $j) + $trySP
    [IO.File]::WriteAllText((Resolve-Path $p), $s, $enc); Write-Output "$p OK"
} else { Write-Output "$p SKIP" }

# 3) backend/build.bat : probe block (between cd and MAVEN_HOME) + tail subroutine  (ASCII file)
$p = 'backend\build.bat'
$s = [IO.File]::ReadAllText((Resolve-Path $p), [Text.Encoding]::ASCII)
$i = $s.IndexOf('rem ---- JDK'); $j = $s.IndexOf('set "MAVEN_HOME=')
$k = $s.IndexOf(':TRYJDK')
if ($i -ge 0 -and $j -gt $i) {
    if ($k -lt 0) { $k = $s.Length }
    $s = $s.Substring(0, $i) + $probeBL + "`r`n" + $s.Substring($j, $k - $j) + $trySP
    [IO.File]::WriteAllText((Resolve-Path $p), $s, [Text.Encoding]::ASCII); Write-Output "$p OK"
} else { Write-Output "$p SKIP" }

# 4) build-appjar.ps1 : dynamic scan (PowerShell native, UTF-8)
$p = 'build-appjar.ps1'
$s = [IO.File]::ReadAllText((Resolve-Path $p), [Text.Encoding]::UTF8)
$oldStart = $s.IndexOf('# JDK ')
$oldEnd = $s.IndexOf('$mvn =')
if ($oldStart -ge 0 -and $oldEnd -gt $oldStart) {
    $newProbe = @'
# JDK 动态发现:JAVA_HOME(校验)→ 扫描 .jdks / Program Files\Java 全部目录,取首个 release 声明主版本>=25 的 JDK
# (jar=class 69,JDK 23/24 会 UnsupportedClassVersionError;不硬编码任何 JDK 目录名,2026-09-24)
$javaOk = $null
$cands = @()
if ($env:JAVA_HOME) { $cands += $env:JAVA_HOME }
$cands += (Get-ChildItem -Directory "$env:USERPROFILE\.jdks" -ErrorAction SilentlyContinue).FullName
$cands += (Get-ChildItem -Directory 'C:\Program Files\Java' -ErrorAction SilentlyContinue).FullName
$cands += (Get-ChildItem -Directory 'D:\Program Files\Java' -ErrorAction SilentlyContinue).FullName
foreach ($c in $cands) {
  if ($c -and (Test-Path "$c\bin\java.exe") -and (Select-String -Path "$c\release" -Pattern 'JAVA_VERSION="2[5-9]\.' -Quiet)) {
    $javaOk = $c; break
  }
}
if (-not $javaOk) { throw "未找到 JDK 25+(pom java.version=25;请安装到 .jdks 或 Program Files\Java)" }
$env:JAVA_HOME = $javaOk

'@
    $s = $s.Substring(0, $oldStart) + $newProbe + $s.Substring($oldEnd)
    [IO.File]::WriteAllText((Resolve-Path $p), $s, (New-Object System.Text.UTF8Encoding($false)))
    Write-Output "$p OK"
} else { Write-Output "$p SKIP" }
