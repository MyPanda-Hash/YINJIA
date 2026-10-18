# start-prod.ps1 — 启动正式环境实例(HSDZ_MES,端口 8090)
# OCR 密钥从环境变量注入(不落库不入 git):$env:ALIBABA_CLOUD_ACCESS_KEY_ID / $env:ALIBABA_CLOUD_ACCESS_KEY_SECRET
# ⚠ 本文件必须保存为 **UTF-8 with BOM**:调用方用的是 Windows PowerShell 5.1,它按 ANSI(GBK)
#   读**无 BOM** 的 UTF-8 脚本 ⇒ 中文注释变乱码、引号/括号错位,报「Missing closing '}'」
#   (2026-10-18 实测:某次编辑去掉 BOM 后当场踩到)。改完务必确认前 3 字节 = EF BB BF。
param([switch]$Stop)
$ErrorActionPreference = "Stop"
$dir = Split-Path $PSScriptRoot -Parent | Split-Path -Parent | Join-Path -ChildPath "backend"

# 实例探测(2026-10-08 修):本机实测 Get-NetTCPConnection -LocalPort 8090 返回 **0 条**,
# netstat 里 8090 也只剩 TIME_WAIT 行(拿不到 LISTENING 行)—— 两条路**都看不见**正在跑的实例,
# 于是 -Stop 空转不杀进程,进程继续占着 jar 文件 ⇒ mvn package 的 repackage 改名失败,
# 磁盘上留下**瘦 jar**(无 BOOT-INF/lib),下次重启直接起不来(一天内踩了两次)。
# 改按**命令行**认实例 —— 但只认「真的在跑这个 jar」(2026-10-18 收紧,见下)。
#
# 🔴 2026-10-18 事故:旧判据是 `CommandLine -match 'yinjia-mes-backend'` —— 只要命令行里
#   **提到**这个名字就算实例。Maven 构建/测试/残留探针的命令行都含模块名,于是一次请求下
#   `start-prod.ps1` 打印「正式实例已在运行 (pid 38192)」后 `exit 0`,而 8090 上并没有服务
#   (随后 curl 全 000;反手直接 java -jar 才起来)。即**脚本报成功、服务没起**,且 -Stop 也可能
#   去杀构建进程。收窄为两个条件同时成立才算实例:
#     ① 有 `-jar` 参数;② 它后面跟的 jar 文件名匹配 yinjia-mes-backend*.jar
#   并排除 Maven 的类世界启动器(plexus-classworlds / org.codehaus.classworlds)。
#   另外加一层 HTTP 探活:命令行认不出但 8090 确实有响应时**不盲目再起**(端口会撞),
#   而是明确告警让人确认 —— 宁可停下来说清楚,不要再假装启动成功。
# 只认 `-jar <url>` 位置上的 jar:引号内允许空格(路径含空格),引号外不跨空白 ——
# 避免 `-jar other.jar --conf=yinjia-mes-backend-1.jar` 这种「先跑别的 jar」被误认成本服务。
$InstanceCmdRx = '-jar\s+(?:"[^"]*yinjia-mes-backend[^"]*\.jar"|[^\s"]*yinjia-mes-backend[^\s"]*\.jar)'
$BuildCmdRx = 'plexus-classworlds|org\.codehaus\.classworlds'

function Get-AppPid {
  $cmd = @(Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue |
           Where-Object {
             $cl = $_.CommandLine
             if (-not $cl) { return $false }
             ($cl -match $InstanceCmdRx) -and ($cl -notmatch $BuildCmdRx)
           } |
           Select-Object -ExpandProperty ProcessId)
  if ($cmd) { return @($cmd | ForEach-Object { [int]$_ } | Sort-Object -Unique) }
  $pids = @()
  try {
    $pids += @(Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue |
               Select-Object -ExpandProperty OwningProcess)
  } catch { }
  if (-not ($pids | Where-Object { $_ })) {
    $pids += @(netstat -ano | Select-String 'LISTENING' | Select-String ':8090' |
               ForEach-Object { ($_.Line -split '\s+')[-1] })
  }
  @($pids | Where-Object { $_ -and [int]$_ -gt 0 } | ForEach-Object { [int]$_ } | Sort-Object -Unique)
}

# 8090 是否有 HTTP 响应(实例活着的**直接**证据,不依赖本机端口表 —— 端口表在本机不可靠)。
function Test-AppAlive {
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8090/' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}

if ($Stop) {
  $kill = Get-AppPid
  if (-not $kill) {
    if (Test-AppAlive) {
      Write-Host "[WARN] 命令行认不出本服务实例,但 8090 仍有 HTTP 响应 ⇒ 没停掉任何东西。" -ForegroundColor Yellow
      Write-Host "       请人工确认占着 8090 的进程(本机端口表不可靠,需按 PID 反查):" -ForegroundColor Yellow
      Write-Host "       Get-CimInstance Win32_Process -Filter `"Name='java.exe'`" | Select ProcessId,CommandLine" -ForegroundColor Yellow
      exit 1
    }
    Write-Host "正式实例(8090)本来就没在运行"; exit 0
  }
  foreach ($procId in $kill) { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue }
  Write-Host "正式实例(8090)已停止(pid $($kill -join ', '))"
  exit 0
}
$c = Get-AppPid
if ($c) { Write-Host "正式实例已在运行: http://127.0.0.1:8090 (pid $($c -join ', '))"; exit 0 }
if (Test-AppAlive) {
  Write-Host "[WARN] 8090 有 HTTP 响应,但命令行认不出是本服务的实例(可能是别的程序占着端口)。" -ForegroundColor Yellow
  Write-Host "       为免端口冲突,本次不启动新实例;请人工确认该进程后再处理。" -ForegroundColor Yellow
  Write-Host "       Get-CimInstance Win32_Process -Filter `"Name='java.exe'`" | Select ProcessId,CommandLine" -ForegroundColor Yellow
  exit 1
}
# 阿里云密钥(OCR + 机翻)从 backend\.env 注入 —— 与 start-project.bat 同一口径。
# ⚠ 不注入的后果是**静默降级**:OCR 报「未配置」、/api/locale/dict 返回空词典(机翻兜底失效)。
#   2026-09-23 实测就因此以为机翻不可用。缺失只提示,不阻断启动。
$envFile = Join-Path $dir ".env"
if (Test-Path $envFile) {
  $n = 0
  foreach ($line in Get-Content $envFile -Encoding UTF8) {
    $t = $line.Trim()
    if (-not $t -or $t.StartsWith('#') -or $t -notmatch '=') { continue }
    $kv = $t -split '=', 2
    [Environment]::SetEnvironmentVariable($kv[0].Trim(), $kv[1].Trim(), 'Process')
    $n++
  }
  Write-Host "已从 backend\.env 注入 $n 个环境变量(OCR/机翻密钥)"
} else {
  Write-Host "提示: 无 backend\.env,OCR 与机翻将降级(功能可用但报未配置)"
}
# JDK discovery, VERSION-GATED (2026-09-24). Backend classes are major 69 (pom java.version=25),
# so ANY JDK < 25 aborts with UnsupportedClassVersionError. Trusting $env:JAVA_HOME blindly is not
# enough: this machine's machine-level JAVA_HOME points at openjdk-23.0.1 (real failure observed
# 2026-09-24). We therefore validate each candidate via its `release` file (JAVA_VERSION >= 25) —
# same policy as start-project.bat :TRYJDK.
function Test-Jdk25([string]$jdkHome) {
  if (-not $jdkHome) { return $false }
  $java = Join-Path $jdkHome 'bin\java.exe'
  $rel = Join-Path $jdkHome 'release'
  if (-not (Test-Path $java) -or -not (Test-Path $rel)) { return $false }
  $line = Select-String -Path $rel -Pattern '^JAVA_VERSION="([0-9]+)' | Select-Object -First 1
  if (-not $line) { return $false }
  $maj = [int]$line.Matches[0].Groups[1].Value
  return ($maj -ge 25)
}
$jdkCands = @()
if ($env:JAVA_HOME) { $jdkCands += $env:JAVA_HOME.TrimEnd('\') }
foreach ($d in @("$env:USERPROFILE\.jdks", 'C:\Program Files\Java', 'D:\Program Files\Java')) {
  if (Test-Path $d) { $jdkCands += (Get-ChildItem -Path $d -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }) }
}
$jdk25 = $jdkCands | Where-Object { Test-Jdk25 $_ } | Select-Object -First 1
if ($jdk25) {
  if ($jdk25 -ne ($env:JAVA_HOME -replace '\\$', '')) { Write-Host "JDK: 使用 $jdk25 (环境 JAVA_HOME 未达 25 或未设)" }
  $env:JAVA_HOME = $jdk25
} else {
  Write-Host "[WARN] JDK 25+ not found - backend will fail to start (classes are major 69)." -ForegroundColor Yellow
}
$javaExe = if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) { "$env:JAVA_HOME\bin\java.exe" } else { 'java' }

# 2026-09-24 起:启动前先做数据库增量同步(治本"拉了代码没跑 SQL"⇒ 界面与实现不一致)。
# 只跑 db-migrations.txt 里新增/内容变化的脚本(幂等);失败不阻断启动,但红字告警。
$root = Split-Path $dir -Parent
$syncBat = Join-Path $root "tools\sync-db.bat"
if (Test-Path $syncBat) {
  Write-Host "数据库增量同步(tools\sync-db.bat) ..."
  & cmd /c "`"$syncBat`""
  if ($LASTEXITCODE -ne 0) {
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host "[警告] 数据库同步失败:界面/字段可能与代码实现不一致!" -ForegroundColor Red
    Write-Host "       处理:确认 SQL Server(Docker mssql2019)在跑后重跑 tools\sync-db.bat" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
  }
}

Start-Process -FilePath $javaExe -ArgumentList "-jar", "target\yinjia-mes-backend-0.1.0.jar" -WorkingDirectory $dir -WindowStyle Hidden
Write-Host "正式实例启动中(HSDZ_MES, http://127.0.0.1:8090;$javaExe) ..."
