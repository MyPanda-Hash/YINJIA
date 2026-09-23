param(
  [Parameter(Mandatory = $true)][string]$Jar,
  [string]$JavaHome = ''
)
# check-jar-runtime.ps1 - can the app.jar actually run on this machine's Java?
#
# WHY: app.jar is assembled by tools/scripts/build-hot-update.ps1, which PATCHES an
# existing jar (jar xf -> javac -> jar uf). MesApplication.class is never recompiled,
# so the artifact silently inherits the class-file version of whatever jar it was
# built from. 2026-09-21 that bit us in production: the server had only JDK 21 while
# the class file was major 69 (Java 25) -> UnsupportedClassVersionError at startup,
# discovered only after the database had already been replaced.
#
# This check answers one question: class-file major version vs the JVM we would run.
#
# Prints ASCII markers only (parsed by deploy-all.bat):
#   RESULT: JAR-MAJOR-<n>
#   RESULT: JVM-VERSION-<n>
#   RESULT: RUNTIME-OK                     jar can run on this JVM
#   RESULT: RUNTIME-FAIL jar-major-<n>-needs-jvm-<m>
#
# PURE ASCII ON PURPOSE: PowerShell 5.1 reads a BOM-less .ps1 as ANSI.
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Jar)) {
  Write-Output 'RESULT: RUNTIME-FAIL jar-not-found'
  exit 1
}

# ---- 1. class-file major version of the Spring Boot entry point -------------
Add-Type -AssemblyName System.IO.Compression.FileSystem
$major = $null
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $Jar).Path)
try {
  $entry = $zip.Entries | Where-Object { $_.FullName -eq 'BOOT-INF/classes/com/yinjia/mes/MesApplication.class' } | Select-Object -First 1
  if (-not $entry) {
    # fall back: any class under BOOT-INF/classes
    $entry = $zip.Entries | Where-Object { $_.FullName -like 'BOOT-INF/classes/com/yinjia/mes/*.class' } | Select-Object -First 1
  }
  if ($entry) {
    $s = $entry.Open()
    try {
      $buf = New-Object byte[] 8
      $read = $s.Read($buf, 0, 8)
      if ($read -ge 8 -and $buf[0] -eq 0xCA -and $buf[1] -eq 0xFE) {
        $major = $buf[6] * 256 + $buf[7]
      }
    } finally { $s.Close() }
  }
} finally { $zip.Dispose() }

if ($null -eq $major) {
  Write-Output 'RESULT: RUNTIME-FAIL cannot-read-class-version'
  exit 1
}
Write-Output ("RESULT: JAR-MAJOR-{0}" -f $major)

# ---- 2. the JVM that would actually run it ---------------------------------
# start-service.bat auto-discovers jdk-25* under Program Files first (that is what
# the server has); the dev machine keeps its JDK under %USERPROFILE%\.jdk. Probe
# both, newest-looking first, and read the `release` file rather than shelling out
# to `java -version` (that writes to stderr and trips $ErrorActionPreference).
$jvmRelease = $null
$jvmHome = $null
function Get-ClassMajor {
  # reads bytes 6..7 of a .class file (CA FE BA BE, minor, major)
  param([string]$Path)
  try {
    $fs = [System.IO.File]::OpenRead($Path)
    try {
      $b = New-Object byte[] 8
      if ($fs.Read($b, 0, 8) -lt 8) { return $null }
      if ($b[0] -ne 0xCA -or $b[1] -ne 0xFE) { return $null }
      return ($b[6] * 256 + $b[7])
    } finally { $fs.Close() }
  } catch { return $null }
}

function Get-JvmMajorFromHome {
  # Returns the highest class-file major this JDK can run, or $null.
  #
  # NOTE: do NOT try to read jmods\java.base.jmod - a .jmod is a ZIP with the JMOD
  # magic, NOT a class file, so the "read the first 8 bytes" trick yields garbage
  # (measured: 772). The `release` file is the reliable source; `java -version` is
  # the last resort for stripped builds.
  param([string]$JdkHome)
  $rel = Join-Path $JdkHome 'release'
  if (Test-Path -LiteralPath $rel) {
    foreach ($ln in (Get-Content -LiteralPath $rel)) {
      if ($ln -match '^\s*JAVA_VERSION\s*=\s*"?([0-9][0-9.]*)"?\s*$') {
        return ([int](($Matches[1] -split '\.')[0]) + 44)
      }
    }
  }
  $exe = Join-Path $JdkHome 'bin\java.exe'
  if (Test-Path -LiteralPath $exe) {
    $txt = (& $exe -version 2>&1 | Out-String)
    if ($txt -match '"([0-9]+)[."]') { return ([int]$Matches[1] + 44) }
  }
  return $null
}

# A JDK root is any directory that actually contains bin\java.exe. Layouts differ:
#   server : C:\Program Files\Eclipse Adoptium\jdk-25.0.4.101-hotspot\bin\java.exe   (depth 1)
#   dev    : %USERPROFILE%\.jdk\jdk-25\jdk-25.0.2\bin\java.exe                       (depth 2)
# so walk a few levels down instead of assuming one.
function Get-JdkRoots {
  param([string]$Base, [int]$Depth = 3)
  $found = New-Object System.Collections.ArrayList
  if (-not (Test-Path -LiteralPath $Base)) { return , $found }
  if (Test-Path -LiteralPath (Join-Path $Base 'bin\java.exe')) { [void]$found.Add($Base) }
  if ($Depth -le 0) { return , $found }
  foreach ($child in (Get-ChildItem -LiteralPath $Base -Directory -ErrorAction SilentlyContinue)) {
    foreach ($r in (Get-JdkRoots -Base $child.FullName -Depth ($Depth - 1))) { [void]$found.Add($r) }
  }
  return , $found
}

$roots = New-Object System.Collections.ArrayList
if ($JavaHome) { [void]$roots.Add($JavaHome) }
foreach ($base in @(
    'C:\Program Files\Eclipse Adoptium',
    'C:\Program Files\Java',
    (Join-Path $env:USERPROFILE '.jdk'),
    'D:\Program Files\Java')) {
  foreach ($r in (Get-JdkRoots -Base $base)) { [void]$roots.Add($r) }
}

# Pick the HIGHEST detected class-file major, not the alphabetically-first path:
# sorting paths puts "D:\..." ahead of "C:\..." and would silently choose an older
# JDK on a machine that has both. What matters is the best JVM this box can offer.
$jvmClassMajor = $null
$jvmHome = $null
$scanned = New-Object System.Collections.ArrayList
foreach ($cand in ($roots | Sort-Object -Unique)) {
  $m = Get-JvmMajorFromHome -JdkHome $cand
  if (-not $m) { continue }
  [void]$scanned.Add(("{0} (major {1})" -f $cand, $m))
  if ($null -eq $jvmClassMajor -or $m -gt $jvmClassMajor) {
    $jvmClassMajor = $m
    $jvmHome = $cand
  }
}
if ($scanned.Count -gt 0) { Write-Output ("RESULT: JVMS-SCANNED " + ($scanned -join ' | ')) }

if (-not $jvmClassMajor) {
  $cmd = Get-Command java -ErrorAction SilentlyContinue
  if ($cmd) {
    $txt = (& $cmd.Source -version 2>&1 | Out-String)
    if ($txt -match '"([0-9]+)[."]') { $jvmClassMajor = [int]$Matches[1] + 44; $jvmHome = '(PATH) ' + $cmd.Source }
  }
}

if (-not $jvmClassMajor) {
  Write-Output 'RESULT: RUNTIME-FAIL no-jvm-found'
  exit 1
}

# class-file major maps to a Java feature release as: java = major - 44  (65->21, 69->25)
Write-Output ("RESULT: JVM-MAJOR-{0}" -f $jvmClassMajor)
Write-Output ("RESULT: JVM-JAVA-{0}" -f ($jvmClassMajor - 44))
Write-Output ("RESULT: JVM-HOME-{0}" -f $jvmHome)

# ---- 3. verdict -------------------------------------------------------------
# A JVM can load class files up to its own major version.
if ($jvmClassMajor -ge $major) {
  Write-Output 'RESULT: RUNTIME-OK'
  exit 0
}
Write-Output ("RESULT: RUNTIME-FAIL jar-major-{0}-needs-java-{1}-but-found-jvm-major-{2}" -f `
  $major, ($major - 44), $jvmClassMajor)
exit 1
