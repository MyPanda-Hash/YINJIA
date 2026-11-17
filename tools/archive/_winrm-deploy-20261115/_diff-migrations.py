#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_diff-migrations.py — 部署前「账本差集」盘点(只读,不改服务器)

用途:算出 `tools/db-migrations.txt`(清单)里 **服务器 yj_schema_log 还没有** 或
**内容哈希不一致** 的脚本,输出待执行清单(按清单顺序),供 run_migrations.py 使用。
背景(2026-11-13 台账):人工列迁移清单会漏(并发会话的提交不在任何人的清单里)⇒ 一律用差集算。

凭据:环境变量 YJ_SERVER_USER / YJ_SERVER_PASS / YJ_WINRM_TRANSPORT=basic(不落盘)。
注意:本机注册表开了系统代理(127.0.0.1:7890),pywinrm 会被它吃掉并回 502
      ⇒ 运行时必须带 NO_PROXY=36.140.66.163(README §6 那条)。

输出:
  - 服务器 yj_schema_log 条数 / 最近一条脚本
  - 缺脚本(清单有、账本无)  N 条
  - 哈希不符(清单有、账本有但内容变了)  M 条
  - 账本多出(清单已删/历史遗留)  K 条 —— 仅提示,不处理
  - --run-list <文件> 把「缺 + 哈希不符」按清单顺序写成一行一个脚本名
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]          # 仓库根
sys.path.insert(0, str(ROOT / "deploy" / "winrm"))

from winrm_client import Server  # noqa: E402

MANIFEST = ROOT / "tools" / "db-migrations.txt"
TOOLS = ROOT / "tools"
DB = "HSDZ_MES"


def manifest_list() -> list[str]:
    out: list[str] = []
    for raw in MANIFEST.read_text(encoding="utf-8").splitlines():
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        if s.endswith(".sql"):
            out.append(s)
    return out


def local_hash(name: str) -> str:
    f = TOOLS / name
    if not f.exists():
        return ""
    return hashlib.sha256(f.read_bytes()).hexdigest()


def server_log(s: Server) -> tuple[dict[str, str], list[str]]:
    """返回 ({脚本名: content_hash 原样}, 非 SHA 哈希的脚本名列表)。

    ⚠ 2026-11-15 实测:账本里有 35 行 content_hash 不是 SHA-256,而是人工标记
    (`MANUAL-20261113-run_migrations` / `MANUAL-20261111-deploy-107a2727b`) ——
    run_migrations.py 当年补登时写的占位值。这类行**代表脚本已执行过**,不能当"缺脚本"
    (上一版解析器把它们判成解析失败 ⇒ 误报 57 条待执行,已修)。
    """
    q = (
        'SET NOCOUNT ON; SELECT script_name, content_hash FROM ' + DB + ".dbo.yj_schema_log"
    )
    rc, out, err = s.ps(
        '$o = & sqlcmd -S localhost -E -h -1 -W -s "|" -f 65001 -Q "' + q + '" 2>&1\n$o'
    )
    log: dict[str, str] = {}
    manual: list[str] = []
    for ln in out.split("\n"):
        ln = ln.strip().strip("\r")
        if not ln:
            continue
        if "|" not in ln:
            continue
        name, h = ln.split("|", 1)
        name, h = name.strip(), h.strip()
        if not name:
            continue
        log[name] = h.lower()
        if not re.fullmatch(r"[0-9a-f]{64}", h.lower()):
            manual.append(name)
    print(f"      账本读到 {len(log)} 条(其中人工标记哈希 {len(manual)} 条)")
    return log, manual


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run-list", default="", help="把待执行清单写到该文件(一行一个)")
    args = ap.parse_args()

    names = manifest_list()
    print(f"[清单] {MANIFEST.name}: {len(names)} 条")

    s = Server(prompt=False)
    log, manual = server_log(s)

    missing, changed, unknown = [], [], []
    for n in names:
        if n not in log:
            missing.append(n)
        elif n in manual:
            unknown.append(n)          # 已执行但哈希是人工标记 ⇒ 不重跑
        else:
            h = local_hash(n)
            if h and h != log[n]:
                changed.append(n)
    extra = [n for n in log if n not in set(names)]

    print(f"\n[差集] 缺脚本 {len(missing)} 条 | 哈希不符 {len(changed)} 条"
          f" | 人工标记(视为已执行) {len(unknown)} 条 | 账本多出 {len(extra)} 条")
    if missing:
        print("\n  ── 清单有、账本无(必须执行)──")
        for n in missing:
            print("   + " + n)
    if changed:
        print("\n  ── 清单有、账本有但内容变了(按 DbSync 口径也要重跑)──")
        for n in changed:
            print("   ~ " + n)
    if unknown:
        print("\n  ── 账本里是人工标记哈希(当年 run_migrations 补登,视为已执行、不重跑)──")
        for n in unknown[:8]:
            print("   ? " + n)
        if len(unknown) > 8:
            print(f"   … 另 {len(unknown)-8} 条")
    if extra:
        print("\n  ── 账本多出(清单已移除/历史遗留,不处理)──")
        for n in extra[:20]:
            print("   - " + n)
        if len(extra) > 20:
            print(f"   … 另 {len(extra)-20} 条")

    if args.run_list:
        Path(args.run_list).write_text("\n".join(missing + changed) + "\n", encoding="utf-8")
        print(f"\n[写出] {args.run_list}:{len(missing)+len(changed)} 条(缺 + 哈希不符,按清单顺序)")

    print("\n[只读] 全程 SELECT,未改服务器任何东西")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
