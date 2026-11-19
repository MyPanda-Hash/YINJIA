#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
probe-field-visible.py — 只读取证：列出 RD_FILTER_EFF「3.数据记录表」动态样品列的 hidden/visible。

用途（2026-11-20「样品列 ＋/－ 只有取样前样品跟着加列」根因取证）：
  前端三组都用 v-for="n in sampleCount"，若某组样品2..6 在 yj_field 里 hidden=1/visible=0，
  元数据就会下发 visible=false（PanelConfigService.fieldSpec），dtHidden() 为真 ⇒ 该组只剩样品1。

用法（只读，不改库）：
  python3 probe-field-visible.py --host 127.0.0.1 --db HSDZ_MES
  python3 probe-field-visible.py --host 36.140.66.163 --db HSDZ_MES --config ../../../deploy/winrm/config.json

凭据来源（优先级）：
  1. 环境变量 YJ_SQL_USER / YJ_SQL_PASS
  2. --config 指定的 deploy/winrm/config.json 的 sql 段（本地私有，已 gitignore）
不打印口令。依赖：pymssql（macOS：python3 -m venv /tmp/v && /tmp/v/bin/pip install pymssql）。
"""
import argparse
import json
import os
import sys

LABELS = [f'出水含量（ug/L）样品{n}' for n in range(2, 7)] + [f'去除率%样品{n}' for n in range(2, 7)]
LABEL_SQL = ','.join("N'" + s.replace("'", "''") + "'" for s in LABELS)


def creds(config_path):
    user = os.environ.get('YJ_SQL_USER')
    pwd = os.environ.get('YJ_SQL_PASS')
    if not (user and pwd) and config_path and os.path.exists(config_path):
        sql = json.load(open(config_path, encoding='utf-8')).get('sql', {})
        user, pwd = sql.get('user'), sql.get('pass')
    if not (user and pwd):
        sys.exit('缺少数据库凭据：设 YJ_SQL_USER/YJ_SQL_PASS 或用 --config 指向 deploy/winrm/config.json')
    return user, pwd


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--port', type=int, default=1433)
    ap.add_argument('--db', default='HSDZ_MES')
    ap.add_argument('--config', default='')
    args = ap.parse_args()

    import pymssql
    user, pwd = creds(args.config)
    conn = pymssql.connect(server=args.host, port=args.port, user=user, password=pwd,
                          database=args.db, charset='UTF-8', login_timeout=20)
    cur = conn.cursor()

    print(f'== {args.host}:{args.port}/{args.db} ==')
    cur.execute(
        "SELECT id, col_name, label, place, seq, hidden, visible FROM yj_field "
        "WHERE panel_code='RD_FILTER_EFF' AND place='detail' "
        "  AND (label LIKE N'出水含量（ug/L）样品%' OR label LIKE N'去除率%样品%' "
        "       OR label LIKE N'压力（PSI)样品%' OR label LIKE N'流速（L/min)样品%') "
        "ORDER BY label")
    rows = cur.fetchall()
    print('id | col_name | label | place | seq | hidden | visible')
    for r in rows:
        print(' | '.join('' if v is None else str(v) for v in r))
    print(f'({len(rows)} rows)')

    cur.execute(
        "SELECT COUNT(*), SUM(CASE WHEN hidden=1 OR visible=0 THEN 1 ELSE 0 END) FROM yj_field "
        "WHERE panel_code='RD_FILTER_EFF' AND place='detail' AND label IN (" + LABEL_SQL + ')')
    total, hidden = cur.fetchone()
    print(f'\n[AUDIT] 出水/去除率 样品2..6：目标 {total} 行，隐藏 {hidden} 行 '
          f'（=0 即与「样品数」同步；>0 即本问题）')
    conn.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
