import openpyxl, json, sys, os
P = r'C:\Users\vigna\Documents\WeChat Files\wxid_9he2bhyytczm22\FileStorage\File\2026-10\引出列表_BOM单_20261019174847.xlsx'
wb = openpyxl.load_workbook(P, read_only=True, data_only=True)
print('sheets =', wb.sheetnames)
ws = wb[wb.sheetnames[0]]
print('dims =', ws.max_row, ws.max_column)
rows = list(ws.iter_rows(values_only=True))
hdr = rows[0]
print('--- HEADERS ---')
for i, h in enumerate(hdr):
    print(i, json.dumps(h, ensure_ascii=False))
print('--- FIRST 8 DATA ROWS (repr) ---')
for r in rows[1:9]:
    print([repr(v) for v in r])
print('--- LAST 5 ROWS ---')
for r in rows[-5:]:
    print([repr(v) for v in r])
# 统计首列(产品编码)空/重复情况
c0 = [r[0] for r in rows[1:]]
print('--- col0 stats ---')
print('data rows =', len(c0))
print('col0 null/empty =', sum(1 for v in c0 if v is None or str(v).strip() == ''))
print('col0 nonempty distinct =', len({str(v).strip() for v in c0 if v is not None and str(v).strip() != ''}))
print('fully-empty rows =', sum(1 for r in rows[1:] if all(v is None or str(v).strip()=='' for v in r)))
