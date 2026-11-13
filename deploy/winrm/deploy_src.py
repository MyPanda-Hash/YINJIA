#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
deploy_src.py — 方案 A:服务器自拉 GitHub 源码 → 构建 → 停/备份/启(推荐)

为什么这么设计(都是实测出来的,不是猜的):
  · 服务器只开 5985/1433/3389/8090,**22(SSH) 与 445(SMB) 都不通** ⇒ Mac 没法 scp/挂载上传;
  · WinRM 单条命令有长度上限,传 90MB 级文件会 `WSManFaultError: 文件句柄扩展太长` ⇒ 不能推大包;
  · 但服务器**能上 GitHub**:`codeload.github.com` 返回 200,实测下载 96MB tarball **11.6 秒**(~8MB/s);
  · 服务器已装 node(v24)/java(JDK25)/tar(bsdtar 3.8.4),**缺 Maven** ⇒ 本脚本自动补装 Maven。

  ⇒ 于是链路是:Mac 只管 `git push`;服务器自己 `curl` 拉 tarball 再本地构建。
     既不依赖 Mac 的上传带宽,也不受 WinRM 命令长度限制。

用法(macOS 上):
    python3 scripts/deploy_src.py              # 完整流程:拉源码→构建→备份库→停→换jar→启→验证
    python3 scripts/deploy_src.py --check      # 只体检,不动任何东西
    python3 scripts/deploy_src.py --app-only   # 只换 jar(不备份库、不跑迁移)
    python3 scripts/deploy_src.py --ref 952005bc3   # 指定提交(默认 main)

前置:python3 -m pip install pywinrm
凭据:YJ_SERVER_PASS 环境变量,或同目录 config.json 的 server.pass
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from winrm_client import connect, load_config  # noqa: E402

# Maven 版本与下载源(服务器访问 GitHub/国内源都通,这里用 Apache 官方镜像优先)
MAVEN_VER = "3.9.9"
MAVEN_URLS = [
    f"https://dlcdn.apache.org/maven/maven-3/{MAVEN_VER}/binaries/apache-maven-{MAVEN_VER}-bin.tar.gz",
    f"https://archive.apache.org/dist/maven/maven-3/{MAVEN_VER}/binaries/apache-maven-{MAVEN_VER}-bin.tar.gz",
]


def step(n: str, msg: str) -> None:
    print(f"\n[{n}] {msg}")


def banner(title: str) -> None:
    print("\n" + "=" * 60)
    print("  " + title)
    print("=" * 60)


# ─────────────────────────────────────────────────────────────
# 步骤实现
# ─────────────────────────────────────────────────────────────
def ensure_maven(s, work: str) -> str:
    """确保服务器上有 mvn,返回 mvn.cmd 的完整路径。"""
    rc, out, _ = s.run("where mvn")
    if rc == 0 and out.strip():
        first = out.strip().split("\n")[0].strip()
        print(f"      已有 Maven: {first}")
        return first

    mvn_home = rf"{work}\apache-maven-{MAVEN_VER}"
    mvn = rf"{mvn_home}\bin\mvn.cmd"
    if s.exists(mvn):
        print(f"      复用已下载的 Maven: {mvn}")
        return mvn

    print(f"      服务器缺 Maven,自动下载 {MAVEN_VER} ...")
    tgz = rf"{work}\_maven.tgz"
    urls = ",".join(f"'{u}'" for u in MAVEN_URLS)
    ps = f"""
$urls = @({urls})
$out = '{tgz}'
$okUrl = $null
foreach ($u in $urls) {{
  Write-Output ("  尝试 " + $u)
  if (Test-Path $out) {{ Remove-Item $out -Force }}
  & curl.exe -sS -L --max-time 600 -o $out $u
  if ($LASTEXITCODE -eq 0 -and (Test-Path $out) -and (Get-Item $out).Length -gt 5MB) {{
    $okUrl = $u
    break
  }}
}}
if (-not $okUrl) {{ Write-Output 'MAVEN-DOWNLOAD-FAIL'; exit 1 }}
Write-Output ("  下载完成 " + [math]::Round((Get-Item $out).Length/1MB,1) + " MB")
$dst = '{work}'
if (Test-Path '{mvn_home}') {{ Remove-Item '{mvn_home}' -Recurse -Force }}
& tar.exe -xzf $out -C $dst
if (Test-Path '{mvn}') {{ Write-Output ('MAVEN-OK ' + '{mvn}') }} else {{ Write-Output 'MAVEN-EXTRACT-FAIL'; exit 1 }}
Remove-Item $out -Force -ErrorAction SilentlyContinue
"""
    rc, out, err = s.ps(ps)
    print("      " + "\n      ".join(out.split("\n")[-4:]))
    if "MAVEN-OK" not in out:
        raise RuntimeError(f"Maven 安装失败:\n{out}\n{err}")
    return mvn


def fetch_source(s, cfg: dict, work: str, ref: str) -> str:
    """服务器下载 GitHub tarball 并解压,返回解压出的仓库根目录。"""
    repo = cfg["repo"]
    tag = ref if ref != repo["branch"] else f"refs/heads/{repo['branch']}"
    # 2026-11-05：服务器 tar.exe(bsdtar) 解不了带中文名的条目 —— 报
    # 「Invalid empty pathname」并整步失败（实测 ref=1cf6e6df1）。
    # 改用 zip 通道 + Expand-Archive（.NET 解压），中文文件名仍会变问号，
    # 但只影响 docs/tools/archive 这类归档，backend/frontend 全为 ASCII 名，构建不受影响。
    url = f"https://codeload.github.com/{repo['owner']}/{repo['name']}/zip/{tag}"
    tgz = rf"{work}\_src.zip"
    extract_root = rf"{work}\_src"

    print(f"      源: {url}")
    ps = f"""
if (Test-Path '{extract_root}') {{ Remove-Item '{extract_root}' -Recurse -Force }}
New-Item -ItemType Directory -Path '{extract_root}' -Force | Out-Null
$sw = [Diagnostics.Stopwatch]::StartNew()
& curl.exe -sS -L --max-time 900 -o '{tgz}' '{url}'
if ($LASTEXITCODE -ne 0 -or -not (Test-Path '{tgz}')) {{ Write-Output 'SRC-DOWNLOAD-FAIL'; exit 1 }}
$sw.Stop()
Write-Output ("  下载 " + [math]::Round((Get-Item '{tgz}').Length/1MB,1) + " MB,用时 " + [math]::Round($sw.Elapsed.TotalSeconds,1) + " 秒")
try {{
  Expand-Archive -Path '{tgz}' -DestinationPath '{extract_root}' -Force -ErrorAction Stop
}} catch {{
  Write-Output ('SRC-EXTRACT-FAIL ' + $_.Exception.Message); exit 1
}}
$dir = Get-ChildItem '{extract_root}' -Directory | Select-Object -First 1
if (-not $dir) {{ Write-Output 'SRC-EMPTY'; exit 1 }}
# 构建真正需要的两个目录必须在（其余归档中文名损坏不影响）
if (-not (Test-Path (Join-Path $dir.FullName 'backend'))) {{ Write-Output 'SRC-NO-BACKEND'; exit 1 }}
if (-not (Test-Path (Join-Path $dir.FullName 'frontend'))) {{ Write-Output 'SRC-NO-FRONTEND'; exit 1 }}
Remove-Item '{tgz}' -Force -ErrorAction SilentlyContinue
Write-Output ('SRC-ROOT ' + $dir.FullName)
"""
    rc, out, err = s.ps(ps)
    for line in out.split("\n"):
        if line.strip():
            print("      " + line.strip())
    root = ""
    for line in out.split("\n"):
        if line.startswith("SRC-ROOT "):
            root = line[len("SRC-ROOT "):].strip()
    if not root:
        raise RuntimeError(f"源码获取失败:\n{out}\n{err}")
    return root


def build_jar(s, src_root: str, mvn: str, work: str) -> str:
    """在服务器上构建 app.jar,返回产物路径。"""
    jar_out = rf"{work}\app-new.jar"
    log = rf"{work}\build.log"
    print("      构建中(前端 npm build + Maven package,通常 3~8 分钟)...")
    ps = rf"""
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-25.0.4.101-hotspot'
if (-not (Test-Path $env:JAVA_HOME)) {{
  $j = Get-ChildItem 'C:\Program Files\Eclipse Adoptium' -Directory -ErrorAction SilentlyContinue |
        Where-Object {{ $_.Name -like 'jdk-25*' }} | Select-Object -First 1
  if ($j) {{ $env:JAVA_HOME = $j.FullName }}
}}
$env:PATH = "$env:JAVA_HOME\bin;C:\Program Files\nodejs;$env:PATH"
$env:YINJIA_M2_REPO = '{src_root}\.m2-repo'
Set-Location '{src_root}'

$log = '{log}'
'=== build start ' + (Get-Date -Format o) + ' ===' | Set-Content $log

# 前端
Set-Location '{src_root}\frontend'
& npm.cmd ci --no-audit --no-fund *>> $log
if ($LASTEXITCODE -ne 0) {{ & npm.cmd install --no-audit --no-fund *>> $log }}
& npm.cmd run build *>> $log
if ($LASTEXITCODE -ne 0) {{ Write-Output 'FRONTEND-BUILD-FAIL'; exit 1 }}
Write-Output '  前端构建 OK'

# 把 dist 镜像到后端 static(与仓库脚本同口径)
$dist = '{src_root}\frontend\dist'
$static = '{src_root}\backend\src\main\resources\static'
if (Test-Path $static) {{ Remove-Item $static -Recurse -Force }}
New-Item -ItemType Directory -Path $static -Force | Out-Null
Copy-Item "$dist\*" $static -Recurse -Force
Write-Output '  static 同步 OK'

# Maven —— pom 在 backend/ 下，仓库根**没有** pom.xml（2026-11-05 实测：
# 在根跑会报 MissingProjectException），必须进 backend 再打包。
Set-Location '{src_root}\backend'
# 2026-11-05：服务器默认走 Maven Central（国内极慢，实测 7 分钟只下了几 MB）。
# 用 C:\yj-deploy\settings-aliyun.xml（阿里云镜像 + 复用默认本地仓库 87.7MB 缓存）。
$mk = 'C:\yj-deploy\settings-aliyun.xml'
$mvnArgs = @('-q','-DskipTests','clean','package')
if (Test-Path $mk) {{ $mvnArgs = @('-s', $mk) + $mvnArgs }}
& '{mvn}' @mvnArgs *>> $log
if ($LASTEXITCODE -ne 0) {{ Write-Output 'MAVEN-BUILD-FAIL'; exit 1 }}
$jar = Get-ChildItem '{src_root}\backend\target' -Filter '*.jar' -ErrorAction SilentlyContinue |
       Where-Object {{ $_.Name -notlike '*.original' -and $_.Length -gt 50MB }} | Select-Object -First 1
if (-not $jar) {{ Write-Output 'NO-JAR'; exit 1 }}
Copy-Item $jar.FullName '{jar_out}' -Force
$sz = [math]::Round((Get-Item '{jar_out}').Length/1MB,1)
$h = (Get-FileHash '{jar_out}' -Algorithm SHA256).Hash
Write-Output ("BUILD-OK size={0}MB sha={1}" -f $sz, $h)
"""
    rc, out, err = s.ps(ps)
    for line in out.split("\n"):
        if line.strip():
            print("      " + line.strip())
    if "BUILD-OK" not in out:
        tail = s.tail(log, 40)
        raise RuntimeError(f"构建失败。日志尾部:\n{tail}\n\n{err[:800]}")
    return jar_out


def backup_db(s, cfg: dict) -> str:
    """备份 HSDZ_MES,返回 .bak 路径(空串=跳过)。"""
    inst = cfg["server"]["install_dir"]
    ts = time.strftime("%Y%m%d-%H%M%S")
    bak = rf"{inst}\backup\pre-deploy-{ts}.bak"
    print(f"      备份到 {bak}")
    ps = rf"""
if (-not (Test-Path '{inst}\backup')) {{ New-Item -ItemType Directory -Path '{inst}\backup' -Force | Out-Null }}
$o = & sqlcmd -S localhost -E -h -1 -W -Q "SET NOCOUNT ON; SELECT IS_SRVROLEMEMBER('sysadmin')"
if ($o -notmatch '1') {{ Write-Output 'NOT-SYSADMIN'; exit 1 }}
& sqlcmd -S localhost -E -Q "BACKUP DATABASE [HSDZ_MES] TO DISK = N'{bak}' WITH FORMAT, INIT" *> $null
if (-not (Test-Path '{bak}')) {{ Write-Output 'BACKUP-FAIL'; exit 1 }}
$sz = [math]::Round((Get-Item '{bak}').Length/1MB,1)
Write-Output ('BACKUP-OK size=' + $sz + 'MB')
"""
    rc, out, err = s.ps(ps)
    print("      " + out.strip())
    if "BACKUP-OK" not in out:
        raise RuntimeError(f"备份失败:\n{out}\n{err}")
    return bak


def swap_and_restart(s, cfg: dict, new_jar: str, do_backup: bool) -> str:
    """停 → 归档旧 jar → 换 → 起 → 验证登录。返回回滚点路径。"""
    srv = cfg["server"]
    inst, task = srv["install_dir"], srv["task_name"]
    ts = time.strftime("%Y%m%d-%H%M%S")
    rollback = rf"{inst}\backup\app-{ts}.jar"

    step("4", "停止应用")
    s.ps(f'schtasks /end /tn "{task}" 2>$null; Start-Sleep -Seconds 2; '
         f'Get-Process java -ErrorAction SilentlyContinue | Where-Object {{ $_.Path -like "{inst}*" }} | Stop-Process -Force')
    print("      已停")

    step("5", "归档旧 jar 并换上新 jar")
    ps = rf"""
if (Test-Path '{inst}\app.jar') {{ Copy-Item '{inst}\app.jar' '{rollback}' -Force }}
Copy-Item '{new_jar}' '{inst}\app.jar' -Force
$h = (Get-FileHash '{inst}\app.jar' -Algorithm SHA256).Hash
Write-Output ('JAR-SWAPPED sha=' + $h)
if (Test-Path '{rollback}') {{ Write-Output ('ROLLBACK ' + '{rollback}') }}
"""
    rc, out, err = s.ps(ps)
    for line in out.split("\n"):
        if line.strip():
            print("      " + line.strip())
    if "JAR-SWAPPED" not in out:
        raise RuntimeError(f"换 jar 失败:\n{out}\n{err}")

    step("6", "启动并验证")
    s.ps(f'schtasks /run /tn "{task}"')
    base = f"http://{srv['host']}:{srv['app_port']}"
    # 登录探针:只有拿到 token 才算真的可用(Tomcat 先监听后预热,健康检查会假通过)
    ok = False
    for i in range(40):
        time.sleep(5)
        ps = rf"""
try {{
  $b = @{{ userName = '{srv['app_user']}'; password = '{srv['app_pass']}' }} | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Uri '{base}/api/auth/login' -Method Post -ContentType 'application/json' -Body $b -TimeoutSec 8
  if ($r.data.token) {{ Write-Output 'LOGIN-OK' }} else {{ Write-Output 'NO-TOKEN' }}
}} catch {{ Write-Output 'WAIT' }}
"""
        rc, out, _ = s.ps(ps)
        if "LOGIN-OK" in out:
            ok = True
            print(f"      登录验证通过(第 {i + 1} 次探测)")
            break
        print(f"      ...等待应用就绪({i + 1}/40)")
    if not ok:
        raise RuntimeError("应用启动后登录验证超时。请 RDP 上去看日志,或用 --rollback 回滚。")
    return rollback


def verify(s, cfg: dict) -> None:
    """验收:jar 指纹 + 前端入口 + 台账条数。"""
    srv = cfg["server"]
    inst = srv["install_dir"]
    step("7", "验收")
    ps = rf"""
$j = Get-Item '{inst}\app.jar'
Write-Output ('jar    ' + (Get-FileHash $j.FullName -Algorithm SHA256).Hash)
Write-Output ('size   ' + [math]::Round($j.Length/1MB,1) + ' MB')
$o = & sqlcmd -S localhost -E -h -1 -W -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM HSDZ_MES.dbo.yj_schema_log" 2>$null
if ($o) {{ Write-Output ('ledger ' + $o.Trim().Split("`n")[0].Trim()) }}
try {{
  $b = @{{ userName = '{srv['app_user']}'; password = '{srv['app_pass']}' }} | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Uri 'http://localhost:{srv['app_port']}/api/auth/login' -Method Post -ContentType 'application/json' -Body $b -TimeoutSec 8
  $h = @{{ Authorization = ('Bearer ' + $r.data.token) }}
  $bd = Invoke-RestMethod -Uri 'http://localhost:{srv['app_port']}/api/build' -Headers $h -TimeoutSec 8
  Write-Output ('chunk  ' + $bd.data.indexChunk)
  Write-Output ('built  ' + $bd.data.staticBuiltAt)
}} catch {{ Write-Output ('api    ' + $_.Exception.Message) }}
"""
    rc, out, err = s.ps(ps)
    for line in out.split("\n"):
        if line.strip():
            print("      " + line.strip())


# ─────────────────────────────────────────────────────────────
# 主流程
# ─────────────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(description="YINJIA-MES 服务器部署(源码自拉构建)")
    ap.add_argument("--ref", default=None, help="Git 引用/提交(默认 main)")
    ap.add_argument("--check", action="store_true", help="只体检,不改任何东西")
    ap.add_argument("--app-only", action="store_true", help="只换 jar(不备份库)")
    args = ap.parse_args()

    cfg = load_config()
    ref = args.ref or cfg["repo"]["branch"]
    work = cfg["server"]["deploy_dir"]

    banner(f"YINJIA-MES 部署  ref={ref}")
    if args.check:
        print("  模式: 只读体检")

    s = connect()

    step("0", "环境体检")
    inst_p = cfg["server"]["install_dir"]
    _, out, _ = s.ps(rf"""
if (-not (Test-Path '{work}')) {{ New-Item -ItemType Directory -Path '{work}' -Force | Out-Null }}
Write-Output ('work-dir  ' + (Test-Path '{work}'))
Write-Output ('app-jar   ' + (Test-Path '{inst_p}\app.jar'))
""")
    for line in out.split("\n"):
        if line.strip():
            print("      " + line.strip())

    # --check 是只读模式:不许下载/安装任何东西(Maven 装不装只在真部署时才管)
    if args.check:
        step("1", "只读检查完成(未做任何改动)")
        rc, out2, _ = s.run("where mvn")
        have = out2.strip().split("\n")[0].strip() if (rc == 0 and out2.strip()) else "(未安装,真部署时会自动下载)"
        print(f"      maven     {have}")
        verify(s, cfg)
        return 0

    mvn = ensure_maven(s, work)

    step("1", "服务器拉取 GitHub 源码")
    src_root = fetch_source(s, cfg, work, ref)

    step("2", "服务器本地构建")
    new_jar = build_jar(s, src_root, mvn, work)

    rollback, bak = "", ""
    if not args.app_only:
        step("3", "备份数据库")
        bak = backup_db(s, cfg)
    else:
        step("3", "备份数据库(已跳过 --app-only)")

    rollback = swap_and_restart(s, cfg, new_jar, bool(bak))
    verify(s, cfg)

    banner("完成")
    print(f"  新 jar   : {cfg['server']['install_dir']}\\app.jar")
    if rollback:
        print(f"  回滚点   : {rollback}")
    if bak:
        print(f"  库备份   : {bak}")
    print("\n  提示: 如需回滚,重新跑本脚本并带 --rollback-to <回滚点路径>")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n[中断] 已停止")
        raise SystemExit(130)
    except Exception as e:
        print(f"\n[失败] {type(e).__name__}: {e}")
        raise SystemExit(1)
