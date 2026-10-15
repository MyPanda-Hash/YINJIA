"""把《生产相关品质检验.xlsx》的「制程检验」页签按网格重建(含合并/列宽/行高)。

渲染不可用,改用结构化读取:逐格输出 + 合并区域映射,还原真实版式。
"""
import openpyxl
from openpyxl.utils import get_column_letter

SRC = r"C:\Users\vigna\Documents\WeChat Files\wxid_9he2bhyytczm22\FileStorage\File\2026-10\生产相关品质检验.xlsx"

wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb["制程检验"]

OUT = []
def p(s=""):
    OUT.append(s)

p("=" * 100)
p("【制程检验】页签 —— 结构化网格重建")
p("=" * 100)

# ── 1. 尺寸信息 ──
p("\n### 1. 列宽(仅列出有定义的)")
for col, dim in sorted(ws.column_dimensions.items()):
    if dim.width:
        p(f"   {col} = {dim.width:.1f}")

p("\n### 2. 行高(仅列出有定义的)")
for row, dim in sorted(ws.row_dimensions.items()):
    if dim.height:
        p(f"   第{row}行 = {dim.height:.1f}")

# ── 2. 合并映射:每个合并区左上角写值,其余写标记 ──
p("\n### 3. 合并区域(带内容)")
merged_map = {}
for mr in ws.merged_cells.ranges:
    merged_map[(mr.min_row, mr.min_col)] = (mr.max_row, mr.max_col, str(mr))
    for r in range(mr.min_row, mr.max_row + 1):
        for c in range(mr.min_col, mr.max_col + 1):
            if (r, c) != (mr.min_row, mr.min_col):
                merged_map[(r, c)] = "CONT"

p("\n### 4. 逐格网格(B24:U38)")
p("     (M=合并区左上角  c=被合并覆盖  空=无值)")
p()

MIN_C, MAX_C = 2, 21   # B..U
MIN_R, MAX_R = 24, 38

# 表头行号
hdr = "      " + "".join(f"{get_column_letter(c):>12}" for c in range(MIN_C, MAX_C + 1))
p(hdr)
p("      " + "-" * (12 * (MAX_C - MIN_C + 1)))

for r in range(MIN_R, MAX_R + 1):
    cells = []
    for c in range(MIN_C, MAX_C + 1):
        v = ws.cell(row=r, column=c).value
        mk = merged_map.get((r, c))
        if mk == "CONT":
            cells.append("  ·")
            continue
        if v is None or str(v).strip() == "":
            cells.append("")
            continue
        s = str(v).replace("\n", "\\n").strip()
        if len(s) > 10:
            s = s[:10] + "…"
        prefix = "M " if mk else "  "
        cells.append(prefix + s)
    line = f"  {r:>3} |" + "".join(f"{x:>12}" for x in cells)
    p(line)

# ── 3. 关键区逐个说明 ──
p("\n### 5. 合并区明细(仅 B24:U38 范围内)")
for mr in sorted(ws.merged_cells.ranges, key=lambda x: (x.min_row, x.min_col)):
    if mr.min_row < MIN_R or mr.min_row > MAX_R:
        continue
    v = ws.cell(row=mr.min_row, column=mr.min_col).value
    vs = "" if v is None else str(v).replace("\n", "\\n")
    p(f"   {str(mr):<12} 左上={get_column_letter(mr.min_col)}{mr.min_row}  值={vs!r}")

txt = "\n".join(OUT)
open(r"D:\workspace\yinjia\tools\archive\_qc-proc\grid.txt", "w", encoding="utf-8").write(txt)
print(txt)
