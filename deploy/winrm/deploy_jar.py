#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
deploy_jar.py — 方案 B:Mac 本地构建 → 推 app.jar 到服务器

什么时候用它:
  · 服务器构建环境出问题(缺 node/npm、Maven 拉不到依赖);
  · 你已经在 Mac 上构建好了 jar,只想快速换上去;
  · 只想推 jar,不想让服务器拉源码。

⚠ 为什么分块:
  WinRM 单条命令有长度上限。实测一次性塞 400KB 的 base64 会报
  `WSManFaultError: 文件句柄扩展太长 (wsmanfault_code 2147942606)`。
  本脚本按 **24KB 一块**发,并用 run_ps(走 stdin)绕开命令行长度限制。

  ⚠ 实测提醒:93MB 的 jar 用这条路大约要 20~40 分钟,而且中途断了要重来。
    **常规部署请优先用 deploy_src.py**(服务器自己下载构建,11 秒拉完源码)。

用法(macOS):
    python3 scripts/deploy_jar.py                       # 用 backend/target/app.jar
    python3 scripts/deploy_jar.py --jar /path/to.jar     # 指定 jar
    python3 scripts/deploy_jar.py --build               # 先在本地构建再推
    python3 scripts/deploy_jar.py --no-restart          # 只上传,不重启

前置:python3 -m pip install pywinrm
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from winrm_client import connect, load_config  # noqa: E402

CHUNK = 24 * 1024          # base64 字符数/块(实测安全值)
REPO_HINT = "仓库根目录(含 backend/ frontend/ tools/)"


def sha256_of(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for blk in iter(lambda: f.read(1 << 20), b""):
            h.update(blk)
    return h.hexdigest()


def local_build(repo: Path) -> Path:
    """在 Mac 上跑 build-appjar 的等价流程。返回 jar 路径。"""
    print(f"[1] 本地构建({repo})")
    fe = repo / "frontend"
    be = repo / "backend"
    if not fe.exists() or not be.exists():
        raise SystemExit(f"[失败] 这不像是仓库根目录(缺 frontend/ 或 backend/): {repo}")

    def run(cmd, cwd):
        print("    $", " ".join(cmd))
        r = subprocess.run(cmd, cwd=str(cwd))
        if r.returncode != 0:
            raise SystemExit(f"[失败] 命令返回 {r.returncode}: {' '.join(cmd)}")

    # 前端
    if not (fe / "node_modules").exists():
        run(["npm", "ci", "--no-audit", "--no-fund"], fe)
    else:
        run(["npm", "install", "--no-audit", "--no-fund"], fe)
    run(["npm", "run", "build"], fe)

    # dist -> backend static(镜像同步,与仓库 build-appjar.ps1 同口径)
    dist, static = fe / "dist", be / "src" / "main" / "resources" / "static"
    print(f"[2] 同步 dist -> {static}")
    if static.exists():
        import shutil

        shutil.rmtree(static)
    static.mkdir(parents=True, exist_ok=True)
    import shutil

    for item in dist.iterdir():
        dst = static / item.name
        if item.is_dir():
            shutil.copytree(item, dst)
        else:
            shutil.copy2(item, dst)

    # Maven
    print("[3] Maven package")
    mvn = "mvn"
    wrapper = repo / "tools" / "apache-maven-3.9.9" / "bin" / "mvn"
    if wrapper.exists():
        mvn = str(wrapper)
    run([mvn, "-q", "-DskipTests", "clean", "package"], be)

    jars = [p for p in (be / "target").glob("*.jar") if not p.name.endswith(".original") and p.stat().st_size > 50 * 1024 * 1024]
    if not jars:
        raise SystemExit("[失败] 没找到 fat jar(可能 repackage 失败,产物是瘦 jar)")
    jar = max(jars, key=lambda p: p.stat().st_size)
    print(f"[4] 产物 {jar}  {jar.stat().st_size / 1024 / 1024:.1f} MB")
    return jar


def upload(s, local: Path, remote: str, label: str = "") -> None:
    """base64 分块上传。失败会重试同一块 3 次。"""
    total = local.stat().st_size
    b64 = base64.b64encode(local.read_bytes()).decode("ascii")
    n = (len(b64) + CHUNK - 1) // CHUNK
    tmp = remote + ".b64"
    print(f"[上传] {len(b64) / 1024 / 1024:.1f} MB base64,{n} 块 × {CHUNK // 1024}KB")

    s.ps(f"if (Test-Path '{tmp}') {{ Remove-Item '{tmp}' -Force }}")

    t0 = time.time()
    for i in range(n):
        part = b64[i * CHUNK:(i + 1) * CHUNK]
        mode = "WriteAllText" if i == 0 else "AppendAllText"
        ps = f"[IO.File]::{mode}('{tmp}', '{part}')"
        for attempt in range(3):
            try:
                rc, out, err = s.ps(ps)
                if rc == 0:
                    break
                raise RuntimeError(err[:200])
            except Exception as e:
                if attempt == 2:
                    raise SystemExit(f"[失败] 第 {i + 1}/{n} 块重试 3 次仍失败: {e}")
                time.sleep(2)
        if (i + 1) % 200 == 0 or i + 1 == n:
            el = time.time() - t0
            done = (i + 1) / n * 100
            rate = (i + 1) * CHUNK / 1024 / 1024 / el if el else 0
            eta = (n - i - 1) * CHUNK / 1024 / 1024 / rate / 60 if rate else 0
            print(f"       {done:5.1f}%  {rate:.2f} MB/s  剩余约 {eta:.0f} 分钟")

    # 还原成二进制并校验
    print("[校验] 解码并比对 SHA256")
    ps = rf"""
$out = '{remote}'
if (Test-Path $out) {{ Remove-Item $out -Force }}
$b64 = Get-Content -LiteralPath '{tmp}' -Raw
[IO.File]::WriteAllBytes($out, [Convert]::FromBase64String($b64))
Remove-Item '{tmp}' -Force
$h = (Get-FileHash $out -Algorithm SHA256).Hash
Write-Output ('UPLOADED sha=' + $h + ' size=' + (Get-Item $out).Length)
"""
    rc, out, err = s.ps(ps)
    print("    " + out.strip())
    want = sha256_of(local)
    if want.lower() not in out.lower():
        raise SystemExit(f"[失败] 校验不一致\n  本地 {want}\n  远端 {out[:200]}")


def main() -> int:
    ap = argparse.ArgumentParser(description="YINJIA-MES 推 jar(方案 B)")
    ap.add_argument("--jar", help="本地 jar 路径(默认 <repo>/backend/target/app.jar)")
    ap.add_argument("--build", action="store_true", help="先在本地构建")
    ap.add_argument("--repo", default=".", help=f"{REPO_HINT},默认当前目录")
    ap.add_argument("--no-restart", action="store_true", help="只上传不重启")
    args = ap.parse_args()

    cfg = load_config()
    srv = cfg["server"]
    inst, task = srv["install_dir"], srv["task_name"]

    repo = Path(args.repo).resolve()
    if args.build:
        jar = local_build(repo)
    elif args.jar:
        jar = Path(args.jar).resolve()
    else:
        jar = repo / "backend" / "target" / "app.jar"
    if not jar.exists():
        raise SystemExit(f"[失败] 找不到 jar: {jar}\n  先跑: python3 scripts/deploy_jar.py --build")

    size_mb = jar.stat().st_size / 1024 / 1024
    print(f"\n=== 推 jar 到 {srv['host']} ===")
    print(f"  本地 {jar}")
    print(f"  大小 {size_mb:.1f} MB")
    print(f"  sha  {sha256_of(jar)}")
    if size_mb > 60:
        print(f"  ⚠ 约 {size_mb * 1.2:.0f} 分钟量级;常规部署建议改用 deploy_src.py")

    s = connect()
    work = srv["deploy_dir"]
    remote = rf"{work}\app-uploaded.jar"
    s.ps(f"if (-not (Test-Path '{work}')) {{ New-Item -ItemType Directory -Path '{work}' -Force | Out-Null }}")

    upload(s, jar, remote)

    if args.no_restart:
        print(f"\n[完成] 已上传到 {remote}(未重启)")
        return 0

    ts = time.strftime("%Y%m%d-%H%M%S")
    rollback = rf"{inst}\backup\app-{ts}.jar"
    print("\n[停服] 归档旧 jar 并换新")
    ps = rf"""
schtasks /end /tn "{task}" 2>$null
Start-Sleep -Seconds 2
Get-Process java -ErrorAction SilentlyContinue | Where-Object {{ $_.Path -like '{inst}*' }} | Stop-Process -Force
if (-not (Test-Path '{inst}\backup')) {{ New-Item -ItemType Directory -Path '{inst}\backup' -Force | Out-Null }}
if (Test-Path '{inst}\app.jar') {{ Copy-Item '{inst}\app.jar' '{rollback}' -Force }}
Copy-Item '{remote}' '{inst}\app.jar' -Force
Write-Output ('JAR-SWAPPED sha=' + (Get-FileHash '{inst}\app.jar' -Algorithm SHA256).Hash)
Write-Output ('ROLLBACK ' + '{rollback}')
"""
    rc, out, err = s.ps(ps)
    for line in out.split("\n"):
        if line.strip():
            print("    " + line.strip())
    if "JAR-SWAPPED" not in out:
        raise SystemExit(f"[失败] 换 jar 失败:\n{out}\n{err}")

    print("\n[启动] 等待登录可用")
    s.ps(f'schtasks /run /tn "{task}"')
    base = f"http://localhost:{srv['app_port']}"
    for i in range(40):
        time.sleep(5)
        rc, out, _ = s.ps(rf"""
try {{
  $b = @{{ userName = '{srv['app_user']}'; password = '{srv['app_pass']}' }} | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Uri '{base}/api/auth/login' -Method Post -ContentType 'application/json' -Body $b -TimeoutSec 8
  if ($r.data.token) {{ 'LOGIN-OK' }} else {{ 'NO-TOKEN' }}
}} catch {{ 'WAIT' }}
""")
        if "LOGIN-OK" in out:
            print(f"      登录验证通过(第 {i + 1} 次)")
            print(f"\n[完成] 回滚点: {rollback}")
            return 0
        print(f"      ...等待就绪({i + 1}/40)")
    print("[失败] 登录验证超时 —— 请 RDP 检查,或把回滚点复制回去")
    return 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n[中断]")
        raise SystemExit(130)
    except Exception as e:
        print(f"\n[失败] {type(e).__name__}: {e}")
        raise SystemExit(1)
