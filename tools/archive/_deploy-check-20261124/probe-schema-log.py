#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
probe-schema-log.py — 2026-11-24 只读体检:服务器库 yj_schema_log 是否已登记 main 上那 17 条迁移。

只跑 SELECT / OBJECT_ID / COL_LENGTH,不写库。
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(r"D:\workspace\yinjia\deploy\winrm")))
from winrm_client import connect  # noqa: E402

SCRIPTS = [
    "migrate-batch-link-qty-sync-20261124.sql",
    "migrate-drop-inv-process-inspection-20261124.sql",
    "migrate-finish-in-produced-qty-20261124.sql",
    "migrate-i18n-upstream-newfields-20261124.sql",
    "migrate-instr-summary-page-20261120.sql",
    "migrate-qc-bhc-resp-per-section-20261123.sql",
    "migrate-qc-bhc-ship-insp-link-20261120.sql",
    "migrate-qc-bhcp-finished-20261124.sql",
    "migrate-qc-flow-rename-20261120.sql",
    "migrate-qc-insp-detail-doclinks-20261123.sql",
    "migrate-qc-insp-detail-panels-20261123.sql",
    "migrate-qc-line-patrol-approval-20261120.sql",
    "migrate-qc-ship-insp-rename-20261120.sql",
    "migrate-route-dates-optional-20261120.sql",
    "migrate-route-process-control-optional-20261119.sql",
    "migrate-sample-reg-list-order-20261120.sql",
    "migrate-sample-reg-seq-20261120.sql",
]


def sql_for(db: str) -> str:
    in_list = ",".join("N'" + s + "'" for s in SCRIPTS)
    return (
        "SET NOCOUNT ON;"
        f"USE [{db}];"
        "SELECT 'LEDGER_ROWS', COUNT(*) FROM dbo.yj_schema_log;"
        f"SELECT 'REGISTERED', COUNT(*) FROM dbo.yj_schema_log WHERE script_name IN ({in_list});"
        "SELECT 'MAX_APPLIED', CONVERT(varchar(19), MAX(applied_at), 120) FROM dbo.yj_schema_log;"
        f"SELECT 'MISSING', script_name FROM (VALUES {','.join('(N' + chr(39) + s + chr(39) + ')' for s in SCRIPTS)}) v(script_name)"
        " WHERE script_name NOT IN (SELECT script_name FROM dbo.yj_schema_log);"
        "SELECT 'OBJ_qc_bhc_cp', ISNULL(OBJECT_ID('dbo.qc_bhc_cp'),0),"
        " ISNULL(OBJECT_ID('dbo.qc_bhc_cp_detail'),0);"
        "SELECT 'COL_bl_finish_in_生产数量', ISNULL(COL_LENGTH('dbo.bl_finish_in',N'生产数量'),-1),"
        " ISNULL(COL_LENGTH('dbo.qc_bhc',N'批次号'),-1), ISNULL(COL_LENGTH('dbo.qc_bhc',N'工单行号'),-1);"
    )


def main() -> int:
    s = connect()
    print("[ok] connected", s.ping())
    for db in ("HSDZ_MES", "HSDZ_MES_TEST"):
        q = sql_for(db)
        # 用 sqlcmd 走 Windows 集成认证;输出用 -W 去尾空格、-h -1 去表头
        cmd = 'sqlcmd -S localhost -d master -E -I -W -h -1 -Q "%s"' % q.replace('"', '\\"')
        rc, out, err = s.run(cmd)
        print(f"\n===== {db} (rc={rc}) =====")
        print(out.strip())
        if err.strip():
            print("--- stderr ---")
            print(err.strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
