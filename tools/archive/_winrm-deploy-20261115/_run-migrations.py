#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_run-migrations.py — 逐条执行迁移(正式库 + 测试库),并用**真实 SHA-256** 补登 yj_schema_log

为什么不直接用 `run_migrations.py`:
  · 它把 content_hash 写成 `MANUAL-<日期>-run_migrations` 占位值(11-13 那批 35 条就是这么来的),
    日后按 DbSync 口径比对会一直显示"内容不符";本脚本改成写脚本字节的 SHA-256,与 DbSync 同口径;
  · 它遇到第一个失败就整批 abort、且**一条都不登记**,前面已执行的会变成"黑账";
    本脚本逐条执行、逐条登记,失败即停但已成功的都有账。

流程(每条):上传(校验字节数) → sqlcmd -d <db> -b -f 65001 -i → 成功则登记 → 下一条
  · 正式库 HSDZ_MES 失败 = 立即停(不影响已成功条目的登记);
  · 测试库 HSDZ_MES_TEST 失败 = 记 FAIL 继续下一条(两账套结构漂移是已知问题,生产优先)。

凭据:YJ_SERVER_USER / YJ_SERVER_PASS / YJ_WINRM_TRANSPORT=basic;必须 NO_PROXY=<host>(本机系统代理会截胡)。
"""
from __future__ import annotations

import argparse
import hashlib
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "deploy" / "winrm"))

from winrm_client import Server          # noqa: E402
from run_migrations import REMOTE_DIR, upload  # noqa: E402

DBS = ["HSDZ_MES", "HSDZ_MES_TEST"]


def new_session() -> Server:
    """新建会话并把超时放宽(pywinrm 默认 read 30s,大脚本会踩到)。"""
    s = Server(prompt=False)
    for attr, val in (("read_timeout_sec", 600), ("operation_timeout_sec", 590)):
        try:
            setattr(s._s.protocol.transport, attr, val)
        except Exception:
            pass
    return s


def run_one(s: Server, db: str, name: str) -> tuple[bool, str]:
    rp = REMOTE_DIR + "\\" + name
    out_file = REMOTE_DIR + "\\_last.txt"
    # -I = SET QUOTED_IDENTIFIER ON。必须加:sqlcmd 默认 OFF,而 CREATE INDEX / 计算列 /
    # 筛选索引等 DDL 在 OFF 下直接报「消息 1934 … 'QUOTED_IDENTIFIER' 的设置不正确」
    # (2026-11-15 实测 migrate-wo-bom-20261113.sql 就是这么失败的两账套各一次)。
    rc, out, _ = s.ps(
        f"& sqlcmd -S localhost -E -d {db} -b -I -f 65001 -i '{rp}' -o '{out_file}' 2>&1 | Out-Null; "
        f"Write-Output ('RC=' + $LASTEXITCODE)"
    )
    ok = "RC=0" in (out or "")
    tail = ""
    _, o2, _ = s.ps(
        f"if (Test-Path '{out_file}') {{ Get-Content '{out_file}' -Encoding UTF8 | "
        f"Select-Object -Last 6 | ForEach-Object {{ Write-Output ('|' + $_) }}; "
        f"Remove-Item '{out_file}' -Force }}"
    )
    for line in (o2 or "").splitlines():
        if line.strip().startswith("|"):
            tail += "        " + line.strip()[1:] + "\n"
    return ok, tail


def register(s: Server, db: str, name: str, sha: str) -> bool:
    q = (
        f"IF EXISTS (SELECT 1 FROM yj_schema_log WHERE script_name = N'{name}') "
        f"UPDATE yj_schema_log SET content_hash = N'{sha}', applied_at = GETDATE() "
        f"WHERE script_name = N'{name}'; "
        f"ELSE INSERT INTO yj_schema_log (script_name, content_hash, applied_at) "
        f"VALUES (N'{name}', N'{sha}', GETDATE());"
    )
    rc, out, _ = s.ps(
        f'& sqlcmd -S localhost -E -d {db} -b -Q "{q}" *> $null; Write-Output ("LOGRC=" + $LASTEXITCODE)'
    )
    return "LOGRC=0" in (out or "")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("scripts", nargs="*", help="脚本名(相对 tools/)")
    ap.add_argument("--list", default="", help="从文件读脚本名(一行一个,保持顺序)")
    ap.add_argument("--db", default="", help="只跑一个库(默认正式+测试)")
    ap.add_argument("--start", type=int, default=1, help="从第几条开始(1 基,断点续跑用)")
    args = ap.parse_args()

    names = [n.strip() for n in args.list and Path(args.list).read_text(encoding="utf-8").splitlines() or [] if n.strip()]
    names += [n for n in args.scripts if n]
    if not names:
        print("没有脚本")
        return 2
    dbs = [args.db] if args.db else DBS

    s = new_session()

    s.ps(f"New-Item -ItemType Directory -Path '{REMOTE_DIR}' -Force | Out-Null; 'DIR-OK'")

    done_ok: dict[str, list[str]] = {d: [] for d in dbs}
    failed: dict[str, list[str]] = {d: [] for d in dbs}
    t0 = time.time()

    for idx, name in enumerate(names, 1):
        if idx < args.start:
            continue
        src = ROOT / "tools" / name
        if not src.exists():
            print(f"[{idx}/{len(names)}] {name}  ✗ 本地找不到")
            return 2
        sha = hashlib.sha256(src.read_bytes()).hexdigest()
        print(f"\n[{idx}/{len(names)}] {name}  ({src.stat().st_size} B, sha={sha[:16]}…)", flush=True)
        for attempt in range(1, 5):
            try:
                if not upload(s, name, src):
                    raise RuntimeError("上传后远端字节数不符")
                for db in dbs:
                    ok, tail = run_one(s, db, name)
                    print(f"    [{db}] {'OK' if ok else 'FAIL'}", flush=True)
                    if not ok:
                        print(tail, end="", flush=True)
                        failed[db].append(name)
                    else:
                        done_ok[db].append(name)
                        if not register(s, db, name, sha):
                            print(f"    [{db}] ⚠ 登记 yj_schema_log 失败", flush=True)
                            failed[db].append(name + "(登记失败)")
                break
            except Exception as e:                      # 网络抖动:重连后重跑该脚本(迁移幂等)
                print(f"    ⚠ 连接/执行异常(第{attempt}次): {type(e).__name__}: {str(e)[:120]}", flush=True)
                if attempt == 4:
                    print("    ✗ 放弃该脚本", flush=True)
                    return 1
                time.sleep(5)
                s = new_session()
        if failed["HSDZ_MES"]:
            print("\n[中止] 正式库失败,后续未执行", flush=True)
            break

    print("\n" + "=" * 60)
    print(f"耗时 {time.time() - t0:.0f}s")
    for db in dbs:
        print(f"  {db}: 成功 {len(done_ok[db])} 条,失败 {len(failed[db])} 条")
        for f in failed[db]:
            print(f"    ✗ {f}")
    return 0 if not failed["HSDZ_MES"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
