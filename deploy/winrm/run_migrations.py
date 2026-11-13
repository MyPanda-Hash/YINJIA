#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
run_migrations.py — 经 WinRM 在**服务器本机**用 sqlcmd 执行迁移脚本。

## 为什么需要它

本仓库的部署分两半：**换 jar**（`deploy_src.py`）和 **跑迁移**。
`deploy_src.py` 里 `DbSync` 出现次数 = 0 —— **它不会跑任何 SQL**。
而生产服务器通常**不对外暴露 1433**（安全组只开 3389/8090/5985），
所以从开发机直连 SQL 往往不通。本脚本绕开这一点：
把 .sql 传到服务器，在**服务器本机**用 `sqlcmd -S localhost` 执行。

## 用法

```bash
# 1) 先只上传、不执行，确认文件落地且字节一致
python run_migrations.py --dry-run tools/migrate-xxx-20260101.sql

# 2) 正式执行（两个账套都跑：先正式库、后测试库）
python run_migrations.py tools/migrate-a.sql tools/migrate-b.sql

# 3) 只跑某一个账套
python run_migrations.py --db HSDZ_MES tools/migrate-a.sql
```

跑完会**自动补登 `yj_schema_log`**（手工执行不会自动进台账，不补登的话下次
`DbSync` 会把它当成"没执行过"再重放一遍）。

## 三个实测踩过的坑（别改掉）

1. **WinRM 单条命令有长度上限**：一次写 8000 字符就报
   `The command line is too long`，所以 base64 分块必须是 **≤1500** 字符。
2. **sqlcmd 按 ANSI 读文件**：迁移脚本是 UTF-8 且含中文，不加 `-f 65001`
   会把中文读成 `??` 然后报语法错。
3. **必须用 `-b`**：否则 SQL 报错时 sqlcmd 仍返回 0，会误判成功。

## 前置

见 `README.md`：服务器口令走 `YJ_SERVER_PASS`，WinRM 用 `YJ_WINRM_TRANSPORT=basic`。
"""
from __future__ import annotations

import argparse
import base64
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]           # deploy/winrm → deploy → repo 根
sys.path.insert(0, str(HERE))
from winrm_client import connect  # noqa: E402

REMOTE_DIR = r"C:\yinjia\backup\mig"
CHUNK = 1500                     # 坑 1：WinRM 单命令上限
DBS_DEFAULT = ["HSDZ_MES", "HSDZ_MES_TEST"]


def upload(s, name: str, src: Path) -> bool:
    rp = REMOTE_DIR + "\\" + name
    b64 = rp + ".b64"
    s.ps(f"Remove-Item -LiteralPath '{b64}' -ErrorAction SilentlyContinue | Out-Null; 'C'")
    data = base64.b64encode(src.read_bytes()).decode()
    for i in range(0, len(data), CHUNK):
        rc, out, err = s.ps(
            f"Add-Content -LiteralPath '{b64}' -Value '{data[i:i + CHUNK]}' -NoNewline -Encoding ascii; 'A'"
        )
        if "A" not in (out or ""):
            print(f"    {name}: 分块写入失败 -> {((out or '') + (err or ''))[:200]}")
            return False
    rc, out, err = s.ps(
        f"$t = Get-Content -LiteralPath '{b64}' -Raw; "
        f"[IO.File]::WriteAllBytes('{rp}', [Convert]::FromBase64String($t)); "
        f"Remove-Item -LiteralPath '{b64}' -Force; (Get-Item '{rp}').Length"
    )
    got = (out or "").strip().splitlines()[-1] if (out or "").strip() else ""
    want = src.stat().st_size
    ok = got.isdigit() and int(got) == want
    print(f"    {name:<52} {'OK' if ok else 'FAIL'}  远端={got} 本地={want}")
    return ok


def main() -> int:
    ap = argparse.ArgumentParser(description="经 WinRM 在服务器本机执行迁移脚本")
    ap.add_argument("scripts", nargs="+", help="迁移脚本路径（相对仓库根或 tools/）")
    ap.add_argument("--dry-run", action="store_true", help="只上传，不执行")
    ap.add_argument("--db", default=None, help="只跑指定库（默认两个账套都跑）")
    ap.add_argument("--no-register", action="store_true", help="不补登 yj_schema_log（不推荐）")
    args = ap.parse_args()

    files = []
    for a in args.scripts:
        p = Path(a)
        if not p.exists():
            p = REPO / "tools" / a
        if not p.exists():
            print(f"找不到脚本: {a}")
            return 2
        files.append(p)

    os.environ.setdefault("YJ_WINRM_TRANSPORT", "basic")
    s = connect()

    print("\n[0] 建远程目录 " + REMOTE_DIR)
    rc, out, err = s.ps(
        f"New-Item -ItemType Directory -Path '{REMOTE_DIR}' -Force | Out-Null; "
        f"if (Test-Path '{REMOTE_DIR}') {{ 'DIR-OK' }} else {{ 'DIR-FAIL' }}"
    )
    if "DIR-OK" not in (out or ""):
        print("    建目录失败:", (out or err or "")[:300])
        return 1

    print("[1] 上传")
    for f in files:
        if not upload(s, f.name, f):
            return 1
    if args.dry_run:
        print("[dry-run] 结束（未执行）")
        return 0

    dbs = [args.db] if args.db else DBS_DEFAULT
    print("[2] 逐库执行（-b 出错即停）")
    for db in dbs:
        for f in files:
            rp = REMOTE_DIR + "\\" + f.name
            out_file = REMOTE_DIR + "\\_last.txt"
            rc, out, err = s.ps(
                f"& sqlcmd -S localhost -E -d {db} -b -f 65001 -i '{rp}' -o '{out_file}' 2>&1 | Out-Null; "
                f"Write-Output ('RC=' + $LASTEXITCODE)"
            )
            ok = "RC=0" in (out or "")
            print(f"    [{db}] {f.name:<52} {'OK' if ok else 'FAIL'}")
            rc2, o2, e2 = s.ps(
                f"if (Test-Path '{out_file}') {{ Get-Content '{out_file}' -Encoding Default | "
                f"Select-Object -Last 8 | ForEach-Object {{ Write-Output ('|' + $_) }}; "
                f"Remove-Item '{out_file}' -Force }}"
            )
            for line in (o2 or "").splitlines():
                if line.strip().startswith("|"):
                    print("        " + line.strip()[1:])
            if not ok:
                print("\n[中止] 第一条失败，后续未执行")
                return 1

    if not args.no_register:
        print("[3] 补登 yj_schema_log（手工执行不会自动进台账）")
        stamp = time.strftime("%Y%m%d")
        for db in dbs:
            for f in files:
                q = (
                    f"IF NOT EXISTS (SELECT 1 FROM yj_schema_log WHERE script_name = N'{f.name}') "
                    f"INSERT INTO yj_schema_log (script_name, content_hash, applied_at) "
                    f"VALUES (N'{f.name}', N'MANUAL-{stamp}-run_migrations', GETDATE());"
                )
                rc, out, err = s.ps(
                    f"& sqlcmd -S localhost -E -d {db} -b -Q \"{q}\" 2>&1 | Out-Null; "
                    f"Write-Output ('LOGRC=' + $LASTEXITCODE)"
                )
                ok = "LOGRC=0" in (out or "")
                print(f"    [{db}] 登记 {f.name:<52} {'OK' if ok else 'FAIL'}")

    print("\n[完成]")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
