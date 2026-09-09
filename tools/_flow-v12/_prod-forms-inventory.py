# _prod-forms-inventory.py — 生产单据 Excel 的 sheet 清单与结构盘点
# 用法: python _prod-forms-inventory.py [深度读取]
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
import openpyxl

import os

ROOT = r"C:\Users\x1787\Documents\xwechat_files\wxid_i0jnge0qyt5w22_b496\msg\file\2026-09\生产相关表格和生产排单表"
FILES = []
for dirpath, _dirs, names in os.walk(ROOT):
    for n in sorted(names):
        if n.lower().endswith(".xlsx"):
            FILES.append(os.path.join(dirpath, n))

DEEP = "--deep" in sys.argv  # 深度模式:打印每个 sheet 前 12 行非空单元格

for fn in FILES:
    print("=" * 10, os.path.basename(fn))
    wb = openpyxl.load_workbook(fn, read_only=True)
    for ws in wb.worksheets:
        try:
            dim = ws.calculate_dimension()
        except Exception:
            dim = "?"
        print(f"  [{ws.sheet_state}] {ws.title!r}  dims={dim}  max_row={ws.max_row} max_col={ws.max_column}")
        if DEEP:
            n = 0
            for row in ws.iter_rows(min_row=1, max_row=15, values_only=True):
                cells = [str(c).replace("\n", "\\n")[:40] for c in row if c is not None and str(c).strip()]
                if cells:
                    n += 1
                    print(f"      r{n}: {' | '.join(cells[:14])}")
            print()
    wb.close()
