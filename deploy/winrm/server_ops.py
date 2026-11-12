#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
server_ops.py — 日常运维小工具(查服务器状态 / 跑 SQL / 回滚)

    python3 scripts/server_ops.py status        # 服务器现状:jar 指纹、前端入口、台账、进程
    python3 scripts/server_ops.py sql "SELECT ..."   # 在服务器上跑 SQL(用服务器自己的 sqlcmd -E)
    python3 scripts/server_ops.py rollback <回滚点.jar>  # 换回指定 jar 并重启
    python3 scripts/server_ops.py logs          # 最近一次部署日志尾部

为什么要"在服务器上跑 SQL":部署脚本用的是 Windows 集成认证(sqlcmd -E),
那个身份只存在于服务器本机。Mac 上直连 1433 只能用 SQL 账号(yinjia),权限不同
(实测 yinjia 不是 sysadmin,做不了 BACKUP DATABASE)。
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from winrm_client import connect, load_config  # noqa: E402


class _NullServer:
    """占位:SQL 走 1433 直连时不需要 WinRM 会话。

    这样 `server_ops.py sql` 在没装 pywinrm、或服务器 WinRM 暂时不通的情况下
    依然能查库(只要 1433 通)。
    """

    def ps(self, *a, **k):
        raise RuntimeError("此操作需要 WinRM 会话,但当前走的是直连模式")

    def run(self, *a, **k):
        raise RuntimeError("此操作需要 WinRM 会话,但当前走的是直连模式")


def cmd_status(s, cfg) -> None:
    srv = cfg["server"]
    inst = srv["install_dir"]
    ps = rf"""
# ⚠ 这里的分节标题一律用 **ASCII**:PowerShell 在中文 Windows 上会把非 ASCII
#   的 Write-Output 按 GBK 编码回传,Python 解码后就成 ??。数字与英文不受影响。
Write-Output '--- process ---'
$p = Get-Process java -ErrorAction SilentlyContinue
if ($p) {{ $p | ForEach-Object {{ Write-Output ('  java pid=' + $_.Id + ' start=' + $_.StartTime) }} }}
else {{ Write-Output '  ** NO JAVA PROCESS (app not running) **' }}

Write-Output '--- app.jar ---'
$j = Get-Item '{inst}\app.jar' -ErrorAction SilentlyContinue
if ($j) {{
  Write-Output ('  sha    ' + (Get-FileHash $j.FullName -Algorithm SHA256).Hash)
  Write-Output ('  size   ' + [math]::Round($j.Length/1MB,1) + ' MB')
  Write-Output ('  mtime  ' + $j.LastWriteTime)
}} else {{ Write-Output '  ** app.jar MISSING **' }}

Write-Output '--- database ---'
$o = & sqlcmd -S localhost -E -h -1 -W -Q "SET NOCOUNT ON; SELECT 'ledger='+CAST((SELECT COUNT(*) FROM HSDZ_MES.dbo.yj_schema_log) AS varchar(10)) + ' panels=' + CAST((SELECT COUNT(*) FROM HSDZ_MES.dbo.yj_panel) AS varchar(10)) + ' fields=' + CAST((SELECT COUNT(*) FROM HSDZ_MES.dbo.yj_field) AS varchar(10))" 2>$null
if ($o) {{ Write-Output ('  ' + $o.Trim()) }}

Write-Output '--- app self-check ---'
try {{
  $b = @{{ userName = '{srv['app_user']}'; password = '{srv['app_pass']}' }} | ConvertTo-Json -Compress
  $r = Invoke-RestMethod -Uri 'http://localhost:{srv['app_port']}/api/auth/login' -Method Post -ContentType 'application/json' -Body $b -TimeoutSec 8
  $h = @{{ Authorization = ('Bearer ' + $r.data.token) }}
  $bd = Invoke-RestMethod -Uri 'http://localhost:{srv['app_port']}/api/build' -Headers $h -TimeoutSec 8
  Write-Output ('  login  OK')
  Write-Output ('  chunk  ' + $bd.data.indexChunk)
  Write-Output ('  built  ' + $bd.data.staticBuiltAt)
}} catch {{ Write-Output ('  login  FAIL ' + $_.Exception.Message) }}

Write-Output '--- recent deploy log ---'
$log = Get-ChildItem '{srv['deploy_dir']}' -Filter 'goapp-*.out' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($log) {{ Write-Output ('  ' + $log.Name) }}
$lg = Get-ChildItem '{srv['deploy_dir']}\pkg-*\logs\deploy-*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($lg) {{ Write-Output ('  ' + $lg.FullName) }}
"""
    rc, out, err = s.ps(ps)
    print(out)
    if err and "CLIXML" not in err:
        print("stderr:", err[:400], file=sys.stderr)


def cmd_sql(s, cfg, sql: str) -> None:
    """查数据库。**优先直连 1433(pymssql)**,只有装不上时才回退 WinRM+sqlcmd。

    为什么优先直连(实测对比):
      · 直连 1433:一次往返,中文天然 UTF-8(`碱性/抑菌/立项申请` 显示正常);
      · 经 WinRM 调服务器 sqlcmd:**中文必然变 ?** —— 已试过 `-f 65001`、`-u`、
        写 UTF-8 BOM 文件、落盘再按 UTF8/Unicode 读回,**全是 ?**。
        根因是 sqlcmd 在中文 Windows 上按 GBK 代码页处理,和传输层无关。
    所以这条路只作为"pymssql 装不上"的兜底,并且**只看数字/英文列时可用**。
    """
    sqlcfg = cfg["sql"]

    # ---- 路径 1:pymssql 直连 ----
    try:
        import pymssql  # noqa: F401
    except ImportError:
        pymssql = None

    if pymssql is not None:
        conn = None
        try:
            conn = pymssql.connect(
                server=sqlcfg["host"], port=sqlcfg.get("port", 1433),
                user=sqlcfg["user"], password=sqlcfg["pass"],
                database=sqlcfg.get("db", "HSDZ_MES"), charset="UTF-8", login_timeout=15,
            )
            cur = conn.cursor()
            cur.execute(sql)
            cols = [d[0] for d in cur.description] if cur.description else []
            rows = cur.fetchall() if cur.description else []
            if not cols:
                print("(无结果集)")
            else:
                print(" | ".join(str(c) for c in cols))
                print("-|-".join("-" * max(2, len(str(c))) for c in cols))
                for r in rows:
                    print(" | ".join("" if v is None else str(v) for v in r))
                print(f"\n({len(rows)} 行)")
            return
        except Exception as e:
            print(f"[pymssql 失败] {type(e).__name__}: {e}", file=sys.stderr)
            print("回退到 WinRM + sqlcmd(中文会显示为 ?)…\n", file=sys.stderr)
        finally:
            try:
                conn and conn.close()
            except Exception:
                pass

    # ---- 路径 2:WinRM + 服务器 sqlcmd(兜底) ----
    payload = "SET NOCOUNT ON;\n" + sql
    ps = rf"""
$sqlf = '{cfg['server']['deploy_dir']}\_q.sql'
$b = [System.Text.Encoding]::UTF8.GetPreamble() + [System.Text.Encoding]::UTF8.GetBytes(@'
{payload}
'@)
[IO.File]::WriteAllBytes($sqlf, $b)
& sqlcmd -S localhost -E -d HSDZ_MES -i $sqlf -f 65001 -W -s "|"
Remove-Item $sqlf -Force -ErrorAction SilentlyContinue
"""
    rc, out, err = s.ps(ps)
    if out:
        print(out)
    if rc != 0 and err:
        print(err, file=sys.stderr)


def cmd_rollback(s, cfg, jar: str) -> None:
    srv = cfg["server"]
    inst, task = srv["install_dir"], srv["task_name"]
    ps = rf"""
if (-not (Test-Path '{jar}')) {{ Write-Output 'NO-SUCH-JAR'; exit 1 }}
schtasks /end /tn "{task}" 2>$null
Start-Sleep -Seconds 2
Get-Process java -ErrorAction SilentlyContinue | Where-Object {{ $_.Path -like '{inst}*' }} | Stop-Process -Force
Copy-Item '{jar}' '{inst}\app.jar' -Force
Write-Output ('RESTORED ' + (Get-FileHash '{inst}\app.jar' -Algorithm SHA256).Hash)
schtasks /run /tn "{task}"
"""
    rc, out, err = s.ps(ps)
    for line in out.split("\n"):
        if line.strip():
            print("  " + line.strip())
    if "RESTORED" not in out:
        raise SystemExit(f"[失败] 回滚失败:\n{out}\n{err}")

    print("  等待登录可用 ...")
    base = f"http://localhost:{srv['app_port']}"
    import time

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
            print(f"  [完成] 回滚成功并已可用(第 {i + 1} 次探测)")
            return
        print(f"  ...等待就绪({i + 1}/40)")
    raise SystemExit("[失败] 回滚后登录验证超时,RDP 上去看日志")


def cmd_logs(s, cfg) -> None:
    d = cfg["server"]["deploy_dir"]
    ps = rf"""
$lg = Get-ChildItem '{d}\pkg-*\logs\deploy-*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($lg) {{
  Write-Output ('=== ' + $lg.FullName + ' ===')
  Get-Content $lg.FullName -Tail 80
}} else {{
  $g = Get-ChildItem '{d}' -Filter 'goapp-*.out' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($g) {{ Write-Output ('=== ' + $g.FullName + ' ==='); Get-Content $g.FullName -Tail 80 }}
  else {{ Write-Output '(没找到部署日志)' }}
}}
"""
    rc, out, err = s.ps(ps)
    print(out)


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 0
    action = sys.argv[1]
    cfg = load_config()

    if action == "status":
        cmd_status(connect(), cfg)
    elif action == "sql":
        if len(sys.argv) < 3:
            raise SystemExit('用法: server_ops.py sql "SELECT ..."')
        # SQL 优先走 1433 直连 —— 不需要 WinRM 也能查,故延迟连接
        try:
            import pymssql  # noqa: F401
            has_pymssql = True
        except ImportError:
            has_pymssql = False
        cmd_sql(connect() if not has_pymssql else _NullServer(), cfg, sys.argv[2])
    elif action == "rollback":
        if len(sys.argv) < 3:
            raise SystemExit("用法: server_ops.py rollback <回滚点.jar 的完整路径>")
        cmd_rollback(connect(), cfg, sys.argv[2])
    elif action == "logs":
        cmd_logs(connect(), cfg)
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
    except Exception as e:
        print(f"\n[失败] {type(e).__name__}: {e}")
        raise SystemExit(1)
