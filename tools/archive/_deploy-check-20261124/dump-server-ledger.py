#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""导出服务器两账套 yj_schema_log 的 script_name 清单,用于与 tools/db-migrations.txt 做差集。"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(r"D:\workspace\yinjia\deploy\winrm")))
from winrm_client import connect  # noqa: E402

OUT = Path(r"D:\workspace\yinjia\tools\archive\_deploy-check-20261124")


def main() -> int:
    s = connect()
    print("[ok] connected", s.ping())
    for db in ("HSDZ_MES", "HSDZ_MES_TEST"):
        q = ("SET NOCOUNT ON; USE [%s]; SELECT script_name FROM dbo.yj_schema_log ORDER BY script_name;" % db)
        rc, out, err = s.run('sqlcmd -S localhost -d master -E -I -W -h -1 -Q "%s"' % q)
        lines = [l.strip() for l in out.splitlines() if l.strip()]
        p = OUT / ("server-ledger-%s.txt" % db)
        p.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"{db}: rc={rc} scripts={len(lines)} -> {p.name}")
        if err.strip():
            print("  stderr:", err.strip()[:200])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
