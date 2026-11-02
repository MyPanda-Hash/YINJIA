import openpyxl
p = r"C:\Users\vigna\Documents\WeChat Files\wxid_9he2bhyytczm22\FileStorage\File\2026-10\引出列表_BOM单_20261019174847.xlsx"
wb = openpyxl.load_workbook(p, read_only=True, data_only=True)
out = []
out.append("sheets: %r" % (wb.sheetnames,))
ws = wb["列表数据"]
out.append("dims: %d x %d" % (ws.max_row, ws.max_column))
rows = list(ws.iter_rows(min_row=1, max_row=5, values_only=True))
for i, r in enumerate(rows, 1):
    out.append("--- row %d" % i)
    for j, c in enumerate(r[:35], 1):
        if c is not None:
            out.append("  c%-2d = %r" % (j, c))
open(r"D:\workspace\yinjia\tools\archive\_asm-bom-import-20261030\_inspect.txt", "w", encoding="utf-8").write("\n".join(out))
print("done")
