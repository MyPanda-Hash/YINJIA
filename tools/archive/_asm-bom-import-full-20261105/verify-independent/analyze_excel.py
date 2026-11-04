# -*- coding: utf-8 -*-
"""独立复核 A/B/E:Excel 口径 + 库内比对(不使用 lead 的 gen/verify 结论)。
Excel 结构(实测):
  第 1 行 = 表头(73 列);最后 1 行 = 「合计」;数据行 3640。
  每个 BOM 块的第一行同时携带表头字段(产品名称/编码/规格/单据编号/默认BOM/工艺路线名/备注/状态...)
  且该行的 物料编码/名称/规格/分子/分子单位/分母/行备注 就是该块第 1 条子件行;
  后续行的 col0 为空,只填子件字段。=> 子件行数 = 数据行数 = 3640,BOM 块数 = col0 非空行数。
"""
import json, re, sys, hashlib, random
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

BASE = r'D:\workspace\yinjia\tools\archive\_asm-bom-import-full-20261105\verify-independent'
EXCEL = r'C:\Users\vigna\Documents\WeChat Files\wxid_9he2bhyytczm22\FileStorage\File\2026-10\引出列表_BOM单_20261019174847.xlsx'
SRC_TAG = '金蝶BOM引出列表_20261019174847'

import openpyxl

def s(v):
    """单元格 -> 去空白字符串(数值型按原样;None -> None)"""
    if v is None:
        return None
    if isinstance(v, str):
        t = v.strip()
        return t if t != '' else None
    return v

def num(v):
    """单元格 -> Decimal 或 None"""
    if v is None:
        return None
    if isinstance(v, str):
        t = v.strip()
        if t == '':
            return None
        return Decimal(t)
    if isinstance(v, (int, float)):
        return Decimal(str(v))
    return Decimal(str(v))

def std_usage(mol, den):
    """标准用量 = ROUND(分子/分母,4);分母空/0 按 1"""
    m = num(mol)
    if m is None:
        return None
    d = num(den)
    if d is None or d == 0:
        d = Decimal(1)
    q = (m / d).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
    return q

wb = openpyxl.load_workbook(EXCEL, read_only=True, data_only=True)
ws = wb['列表数据']
raw = list(ws.iter_rows(values_only=True))
hdr = raw[0]
assert len(hdr) == 73, len(hdr)
body = raw[1:]
# 去掉「合计」行与全空行
body = [r for r in body if not (s(r[0]) == '合计') and any(s(v) is not None for v in r)]
excel_blocks = []   # 每块 dict
excel_rows = []     # 子件行 dict
cur = None
for r in body:
    prod_name = s(r[0]); prod_code = s(r[1]); prod_spec = s(r[2])
    if prod_name is not None:
        # 新块首行
        bill = s(r[9])
        ver = None
        m = re.search(r'(_V\d+)$', bill or '')
        if m:
            ver = m.group(1)[1:]
        cur = dict(产品名称=prod_name, 产品编码=prod_code, 规格型号=prod_spec, 单据编号=bill, 版本号=ver,
                   默认BOM=s(r[15]), 工艺路线名称=s(r[25]), 备注=s(r[6]), 状态=s(r[14]),
                   审核状态=s(r[13]), 工序名称=s(r[51]), 单位=s(r[7]), 行数=0)
        excel_blocks.append(cur)
    assert cur is not None, 'continuation row before block header'
    row = dict(
        单据编号=cur['单据编号'], 产品编码=cur['产品编码'], 产品名称=cur['产品名称'], 规格型号=cur['规格型号'],
        版本号=cur['版本号'], 默认BOM=cur['默认BOM'], 工艺路线名称=cur['工艺路线名称'], 备注=cur['备注'], 状态=cur['状态'],
        行序=cur['行数'] + 1,
        子件编码=s(r[3]), 子件名称=s(r[4]), 子件规格=s(r[5]),
        用量分子=num(r[10]), 分子单位=s(r[11]), 用量分母=num(r[12]), 行备注=s(r[31]),
        标准用量=std_usage(r[10], r[12]),
    )
    cur['行数'] += 1
    excel_rows.append(row)

print('== A. Excel 独立口径 ==')
print('数据行(含块首行) =', len(body))
print('BOM 块数 =', len(excel_blocks))
print('产品数(distinct 产品编码) =', len({b['产品编码'] for b in excel_blocks}))
print('子件行数 =', len(excel_rows))
print('块行数合计 =', sum(b['行数'] for b in excel_blocks))
from collections import Counter, defaultdict
c = Counter(b['行数'] for b in excel_blocks)
print('每块行数分布 =', dict(sorted(c.items())))
docs = Counter(b['单据编号'] for b in excel_blocks)
print('单据编号重复(块数>1) =', {k: v for k, v in docs.items() if v > 1})
byprod = defaultdict(list)
for b in excel_blocks:
    byprod[b['产品编码']].append(b)
multi = {p: [(b['单据编号'], b['行数'], b['默认BOM']) for b in bs] for p, bs in byprod.items() if len(bs) > 1}
print('多版本产品数 =', len(multi))
for p in sorted(multi):
    print('   ', p, multi[p])
print('默认BOM=是 块数 =', sum(1 for b in excel_blocks if b['默认BOM'] == '是'))
print('默认BOM 值分布 =', dict(Counter(b['默认BOM'] for b in excel_blocks)))
print('使用状态分布 =', dict(Counter(b['状态'] for b in excel_blocks)))
print('审核状态分布 =', dict(Counter(b['审核状态'] for b in excel_blocks)))
print('工序名称分布 =', dict(Counter(b['工序名称'] for b in excel_blocks)))
print('BOM级备注非空块 =', sum(1 for b in excel_blocks if b['备注'] is not None))
print('行备注非空行 =', sum(1 for r in excel_rows if r['行备注'] is not None))
print('工艺路线名称为空块 =', sum(1 for b in excel_blocks if b['工艺路线名称'] is None))
print('产品规格为空块 =', sum(1 for b in excel_blocks if b['规格型号'] is None))
print('用量分母≠1 行 =', sum(1 for r in excel_rows if r['用量分母'] != Decimal(1)))
print('用量分母为空 行 =', sum(1 for r in excel_rows if r['用量分母'] is None))
print('用量分子为空 行 =', sum(1 for r in excel_rows if r['用量分子'] is None))
print('分子单位为空 行 =', sum(1 for r in excel_rows if r['分子单位'] is None))
print('子件编码为空 行 =', sum(1 for r in excel_rows if r['子件编码'] is None))

# 保存解析结果
def js_default(o):
    if isinstance(o, Decimal):
        return str(o)
    raise TypeError
with open(BASE + r'\excel-parsed.json', 'w', encoding='utf-8') as f:
    json.dump(dict(blocks=excel_blocks, rows=excel_rows), f, ensure_ascii=False, default=js_default)
print('[saved] excel-parsed.json')
