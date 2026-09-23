# _set-jdk25-default.ps1 -- Make JDK 25 the SYSTEM DEFAULT (Machine JAVA_HOME + PATH order).
# MUST RUN ELEVATED (Run as Administrator). Idempotent. ASCII-only on purpose:
#   PS 5.1 reads a BOM-less file in the OEM codepage, so any non-ASCII here would break parsing
#   (see repo pitfall ledger C2).
#
# What it does:
#   1. copy the already-installed JDK 25 to C:\Program Files\Java\jdk-25
#      (machine-wide stable path; independent of the per-user IDE cache under %USERPROFILE%\.jdk)
#   2. set Machine JAVA_HOME to that path
#   3. put its bin at the FRONT of Machine PATH
#      (Windows resolves Machine PATH before User PATH, so the Oracle javapath -> JDK 24 entry
#       can only be beaten by prepending; the javapath entry itself is left untouched)
#   4. broadcast WM_SETTINGCHANGE so Explorer-spawned apps pick the new environment up
#   5. write a rollback file with the previous Machine PATH / JAVA_HOME
#
# Files written (all under %TEMP%):
#   set-jdk25-default.log            step-by-step log
#   set-jdk25-default.done           marker (contains RESULT: ...)
#   set-jdk25-default-rollback.txt   previous values, for manual rollback
#
# Rollback: run the two SetEnvironmentVariable lines printed at the end of the log (as admin).

$ErrorActionPreference = 'Stop'
$log    = Join-Path $env:TEMP 'set-jdk25-default.log'
$marker = Join-Path $env:TEMP 'set-jdk25-default.done'
$bak    = Join-Path $env:TEMP 'set-jdk25-default-rollback.txt'
Remove-Item $marker -Force -ErrorAction SilentlyContinue

function Log([string]$m) {
    $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m
    Add-Content -LiteralPath $log -Value $line -Encoding UTF8
    Write-Host $line
}

# PS 5.1 quirk: '& native.exe 2>&1' turns stderr into ErrorRecords, and under
# $ErrorActionPreference='Stop' that TERMINATES the script (java -version writes to stderr!).
# Wrap native calls in cmd /c so only stdout reaches PowerShell (see repo pitfall ledger G1).
function JavaVersion([string]$exe) {
    (cmd /c "`"$exe`" -version 2>&1" | Select-Object -First 1)
}

$src = Join-Path $env:USERPROFILE '.jdk\jdk-25\jdk-25.0.2'
$dst = 'C:\Program Files\Java\jdk-25'
$bin = Join-Path $dst 'bin'

try {
    $isAdmin = (New-Object Security.Principal.WindowsPrincipal(
        [Security.Principal.WindowsIdentity]::GetCurrent())
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    Log "elevated = $isAdmin"
    if (-not $isAdmin) { throw 'not elevated: run this script as Administrator' }

    if (-not (Test-Path (Join-Path $src 'bin\javac.exe'))) { throw "source JDK 25 not found: $src" }
    $srcVer = JavaVersion (Join-Path $src 'bin\java.exe')
    Log "source : $src  ($srcVer)"

    # ---- 0) backup current Machine env (rollback point) ----
    $oldPath = [Environment]::GetEnvironmentVariable('PATH', 'Machine')
    $oldHome = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'Machine')
    @(
        "Machine JAVA_HOME (before) = $oldHome"
        "Machine PATH (before)      = $oldPath"
        ""
        "Rollback (run as Administrator):"
        "  [Environment]::SetEnvironmentVariable('JAVA_HOME', '$oldHome', 'Machine')"
        "  [Environment]::SetEnvironmentVariable('PATH', '$oldPath', 'Machine')"
    ) | Set-Content -LiteralPath $bak -Encoding UTF8
    Log "backup -> $bak"

    # ---- 1) copy JDK 25 to Program Files (machine-wide stable location) ----
    if (Test-Path (Join-Path $dst 'bin\java.exe')) {
        $dstVer = JavaVersion (Join-Path $dst 'bin\java.exe')
        Log "target already present, skipping copy ($dstVer)"
    } else {
        Log "copying JDK 25 -> $dst ..."
        $null = New-Item -ItemType Directory -Path 'C:\Program Files\Java' -Force
        robocopy $src $dst /E /NFL /NDL /NJH /NJS /R:1 /W:1 | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit=$LASTEXITCODE)" }
        Log "copy done (robocopy exit=$LASTEXITCODE)"
    }
    if (-not (Test-Path (Join-Path $bin 'javac.exe'))) { throw "copy incomplete: no javac.exe in $bin" }
    $dstVer = JavaVersion (Join-Path $bin 'java.exe')
    Log "target : $dst  ($dstVer)"

    # ---- 2) Machine JAVA_HOME ----
    [Environment]::SetEnvironmentVariable('JAVA_HOME', $dst, 'Machine')
    Log "Machine JAVA_HOME set to $dst"

    # ---- 3) Machine PATH: our bin first, keep the rest (dedupe our entry) ----
    $parts = @($oldPath -split ';' | Where-Object { $_ -and ($_.TrimEnd('\') -ne $dst) })
    $newPath = (@($bin) + $parts) -join ';'
    [Environment]::SetEnvironmentVariable('PATH', $newPath, 'Machine')
    Log "Machine PATH updated: '$bin' prepended (entries: $($parts.Count + 1))"

    # ---- 4) broadcast WM_SETTINGCHANGE (Explorer-spawned apps would otherwise keep the old env) ----
    $sig = @'
using System;
using System.Runtime.InteropServices;
public class EnvBcast {
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam,
        string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
}
'@
    Add-Type -TypeDefinition $sig -ErrorAction SilentlyContinue
    $res = [UIntPtr]::Zero
    $null = [EnvBcast]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero,
        'Environment', 2, 5000, [ref]$res)
    Log 'WM_SETTINGCHANGE broadcast sent'

    # ---- 5) verify (registry round-trip; a fresh process picks this up) ----
    $nowHome = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'Machine')
    $nowPath = [Environment]::GetEnvironmentVariable('PATH', 'Machine')
    $firstPathEntry = ($nowPath -split ';')[0]
    Log "verify: Machine JAVA_HOME = $nowHome"
    Log "verify: Machine PATH[0]  = $firstPathEntry"
    $ok = ($nowHome -eq $dst) -and ($firstPathEntry.TrimEnd('\') -eq $bin.TrimEnd('\'))
    "RESULT: " + $(if ($ok) { 'DONE' } else { 'CHECK-FAILED' }) | Set-Content -LiteralPath $marker -Encoding ASCII
    Log "marker -> $marker"
} catch {
    Log "ERROR: $($_.Exception.Message)"
    "RESULT: ERROR - $($_.Exception.Message)" | Set-Content -LiteralPath $marker -Encoding ASCII
}
