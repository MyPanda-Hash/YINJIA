# -*- coding: utf-8 -*-
"""独立复核 A/B/E(1):把 Excel 独立解析结果与 dbo.bs_asm_bom 全量 3640 行逐字段比对,
并解析上一版 migrate-asm-bom-data-20261030.sql 的 1085 行做新旧同键比对。
所有结论均由本脚本自行计算,不引用 lead 的 gen-report/verify.py 结果。
"""
import json, re
from decimal import Decimal
from collections import Counter, defaultdict

BASE = r'D:\workspace\yinjia\tools\archive\_asm-bom-import-full-20261105\verify-independent'
REPO = r'D:\workspace\yinjia'
SRC_TAG = '金蝶BOM引出列表_20261019174847'
OUT = []

def p(*a):
    line = ' '.join(str(x) for x in a)
    OUT.append(line)
    print(line)

def load_dump(fn):
    rows = None; cols = None
    with open(BASE + '\\' + fn, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            o = json.loads(line)
            if o.get('rs') == 0 and 'rows' in o:
                cols = o['columns']; rows = o['rows']
    assert cols is not None and rows is not None
    return [dict(zip(cols, r)) for r in rows]

def n(v):
    return None if v is None else Decimal(v)

def eq_num(a, b):
    a, b = n(a), n(b)
    return a == b

# ---------- 载入 ----------
with open(BASE + r'\excel-parsed.json', encoding='utf-8') as f:
    ex = json.load(f)
eblocks, erows = ex['blocks'], ex['rows']
for _r in erows:
    for _f in ('标准用量', '用量分子', '用量分母'):
        if _r[_f] is not None:
            _r[_f] = Decimal(_r[_f])
for b in eblocks:
    for k in ('行数',):
        pass
db = load_dump('out-q1-HSDZ_MES.json')
db_test = load_dump('out-q1-HSDZ_MES_TEST.json')
other = load_dump('out-q2-other-HSDZ_MES.json')
invrows = load_dump('out-q4-invunits-HSDZ_MES.json')
inv = defaultdict(set)
for r in invrows:
    if r['计量单位']:
        inv[r['存货编码']].add(r['计量单位'])

p('#### A. 口径(Excel 独立解析 vs 库)####')
p('Excel: 块=%d 产品=%d 子件行=%d' % (len(eblocks), len({b['产品编码'] for b in eblocks}), len(erows)))
p('DB   : 行=%d 单据=%d 产品=%d' % (len(db), len({r['单据编号'] for r in db}), len({r['产品编码'] for r in db})))
p('DB 来源标记全部正确: %s' % all(r['来源'] == SRC_TAG for r in db))
p('DB 每单行数分布 = %s' % dict(sorted(Counter(Counter(r['单据编号'] for r in db).values()).items())))
p('Excel 每块行数分布 = %s' % dict(sorted(Counter(b['行数'] for b in eblocks).items())))
docs_ex = {b['单据编号'] for b in eblocks}
docs_db = {r['单据编号'] for r in db}
p('单据集合: Excel=%d DB=%d 缺失=%s 多余=%s' % (len(docs_ex), len(docs_db), sorted(docs_ex - docs_db), sorted(docs_db - docs_ex)))
p('产品集合: Excel=%d DB=%d 缺失=%s 多余=%s' % (len({b['产品编码'] for b in eblocks}), len({r['产品编码'] for r in db}),
   sorted({b['产品编码'] for b in eblocks} - {r['产品编码'] for r in db}), sorted({r['产品编码'] for r in db} - {b['产品编码'] for b in eblocks})))
byprod = defaultdict(list)
for b in eblocks:
    byprod[b['产品编码']].append(b['单据编号'])
multi_ex = {k: sorted(v) for k, v in byprod.items() if len(v) > 1}
db_byprod = defaultdict(set)
for r in db:
    db_byprod[r['产品编码']].add(r['单据编号'])
multi_db = {k: sorted(v) for k, v in db_byprod.items() if len(v) > 1}
p('多版本产品: Excel=%d DB=%d 集合一致=%s' % (len(multi_ex), len(multi_db), multi_ex == multi_db))
p('  多版本明细: %s' % json.dumps(multi_ex, ensure_ascii=False))
p('TEST 库: 行=%d 单据=%d 产品=%d, 与正式库逐行一致=%s' % (
   len(db_test), len({r['单据编号'] for r in db_test}), len({r['产品编码'] for r in db_test}),
   [ {k:v for k,v in r.items() if k not in ('asp_time1','asp_user2','asp_time2')} for r in db] ==
   [ {k:v for k,v in r.items() if k not in ('asp_time1','asp_user2','asp_time2')} for r in db_test]))

# ---------- B. 全量逐字段比对 ----------
# 期望值来自 Excel;计量单位单列判定
key = lambda r: (r['单据编号'], int(r['行序']))
dbk = {key(r): r for r in db}
p('\n#### B. 全量逐字段比对(3640 行,非抽样)####')
p('DB 键唯一: %s' % (len(dbk) == len(db)))
mism = defaultdict(list)
fields = [
    ('产品编码', '产品编码'), ('产品名称', '产品名称'), ('规格型号', '规格型号'),
    ('版本号', '版本号'), ('默认BOM', '默认BOM'), ('工艺路线名称', '工艺路线名称'),
    ('状态', '状态'), ('子件编码', '子件编码'), ('子件名称', '子件名称'), ('子件规格', '子件规格'),
    ('行备注', '行备注'), ('备注', '备注'),
]
for e in erows:
    k = key(e)
    r = dbk.get(k)
    if r is None:
        mism['DB缺行'].append(k); continue
    for f, ef in fields:
        if r[f] != e[ef]:
            mism[f].append((k, e[ef], r[f]))
    for f, ef in (('标准用量', '标准用量'), ('用量分子', '用量分子'), ('用量分母', '用量分母')):
        if not eq_num(r[f], e[ef]):
            mism[f].append((k, e[ef], r[f]))
    if r['工序'] != '组装':
        mism['工序'].append((k, '组装', r['工序']))
    if r['来源'] != SRC_TAG:
        mism['来源'].append((k, SRC_TAG, r['来源']))
    if not eq_num(r['损耗量'], 0):
        mism['损耗量'].append((k, 0, r['损耗量']))
    if r['asp_user1'] != '金蝶BOM导入' or r['asp_cancel'] != 'N' or r['asp_user2'] is not None or r['asp_time2'] is not None:
        mism['asp_*'].append((k, r['asp_user1'], r['asp_cancel'], r['asp_user2'], r['asp_time2']))
    # 计量单位
    eu = e['分子单位']
    if e['子件编码'] in inv:
        if r['计量单位'] not in inv[e['子件编码']]:
            mism['计量单位(不在存货档案集合)'].append((k, e['子件编码'], sorted(inv[e['子件编码']]), r['计量单位']))
    else:
        if r['计量单位'] != eu:
            mism['计量单位(档案缺→应=Excel分子单位)'].append((k, e['子件编码'], eu, r['计量单位']))
for k in mism:
    p('  %-40s 差异 %d 条; 例: %s' % (k, len(mism[k]), mism[k][:3] if mism[k] else ''))
p('全量逐字段比对结果: %s' % ('PASS(零差异)' if not mism else 'FAIL'))
p('额外检查: 计量单位为空行=%d, 标准用量≠ROUND(分子/分母,4)行=%d, 行序不连续单据=%d, 单据数/产品数=%d/%d' % (
   sum(1 for r in db if not r['计量单位']),
   sum(1 for r in db if abs(n(r['标准用量']) - (n(r['用量分子']) / (n(r['用量分母']) if n(r['用量分母']) != 0 else Decimal(1)))) > Decimal('0.00005')),
   sum(1 for doc in {r['单据编号'] for r in db}
       if sorted(int(r['行序']) for r in db if r['单据编号'] == doc) != list(range(1, 1 + sum(1 for r in db if r['单据编号'] == doc)))),
   len({r['单据编号'] for r in db}), len({r['产品编码'] for r in db})))
p('存货档案命中: %d/%d 种子件编码有档案单位;档案未命中=%d' % (
   sum(1 for e in erows if e['子件编码'] in inv), len({e['子件编码'] for e in erows}),
   sum(1 for e in erows if e['子件编码'] not in inv)))
p('多单位档案(同一编码多个单位)编码数=%d' % sum(1 for c, s in inv.items() if len(s) > 1))
unit_div = [(key(e), e['分母'] if '分母' in e else None, e['分子单位'], dbk[key(e)]['计量单位'])
            for e in erows if e['子件编码'] in inv and dbk[key(e)]['计量单位'] != e['分子单位']]
p('信息项: Excel「分子单位」与库「计量单位(存货档案)」不同的行数 = %d (以档案为准); 例: %s' % (len(unit_div), unit_div[:5]))

# ---------- B 抽样证据(固定种子,可复现) ----------
import random
random.seed(20261105)
sample = []
def pick(pred, n_, label):
    cands = [e for e in erows if pred(e)]
    got = random.sample(cands, min(n_, len(cands)))
    for e in got:
        sample.append((label, e))
    return len(cands), len(got)
counts = []
counts.append(('多版本产品A', pick(lambda e: e['产品编码'] == 'A-48-05', 4, '多版本A-48-05')))
counts.append(('多版本产品B', pick(lambda e: e['产品编码'] in ('S051-2', 'T073-3'), 4, '多版本S051-2/T073-3')))
counts.append(('行备注非空', pick(lambda e: e['行备注'] is not None, 8, '行备注非空')))
counts.append(('行备注为空', pick(lambda e: e['行备注'] is None, 6, '行备注空')))
counts.append(('用量分母≠1', pick(lambda e: e['用量分母'] != Decimal(1), 8, '分母≠1')))
counts.append(('产品规格为空', pick(lambda e: e['规格型号'] is None, 5, '产品规格空')))
counts.append(('工艺路线为空', pick(lambda e: e['工艺路线名称'] is None, 5, '工艺路线空')))
n_sample = len(sample)
p('\n#### B 抽样:共 %d 行(要求≥30)####' % n_sample)
bad_sample = 0
for label, e in sample:
    k = key(e); r = dbk[k]
    diff = []
    for f in ('单据编号','产品编码','产品名称','规格型号','版本号','默认BOM','工艺路线名称','状态','行序','子件编码','子件名称','子件规格','计量单位','标准用量','用量分子','用量分母','行备注','备注'):
        ev = e[f] if f in e else e.get(f)
        if f == '计量单位':
            exp = sorted(inv[e['子件编码']])[0] if e['子件编码'] in inv else e['分子单位']
            if r[f] != exp: diff.append('%s: Excel档案/分子单位=%r DB=%r' % (f, exp, r[f]))
        elif f in ('标准用量','用量分子','用量分母'):
            if not eq_num(r[f], e[f]): diff.append('%s: Excel=%s DB=%s' % (f, e[f], r[f]))
        elif f == '行序':
            if int(r[f]) != int(e[f]): diff.append('%s: Excel=%r DB=%r' % (f, e[f], r[f]))
        else:
            if r[f] != e[f]: diff.append('%s: Excel=%r DB=%r' % (f, e[f], r[f]))
    if diff:
        bad_sample += 1
        p('  [FAIL] %s %s 行%d: %s' % (label, k[0], k[1], '; '.join(diff)))
p('抽样不一致行数 = %d/%d' % (bad_sample, n_sample))
p('抽样覆盖统计: %s' % counts)

# ---------- E. 上一版 1085 行新旧同键比对 ----------
p('\n#### E. 上一版 migrate-asm-bom-data-20261030.sql(1085 行/236 单)与当前库同键比对 ####')
old_sql = open(REPO + r'\tools\migrate-asm-bom-data-20261030.sql', encoding='utf-8').read()
cols_m = re.search(r'INSERT INTO dbo\.bs_asm_bom \(([^)]*)\) VALUES', old_sql)
old_cols = [c.strip() for c in cols_m.group(1).split(',')]
p('旧脚本插入列(%d): %s' % (len(old_cols), old_cols))
# 解析 VALUES 元组(状态机,支持 N'...' 内 '' 转义 与 SYSDATETIME() 等函数调用)
def parse_vals(text):
    rows = []
    i = 0; n_ = len(text)
    in_tuple = False
    vals = []
    while i < n_:
        c = text[i]
        if not in_tuple:
            if c == '(':
                in_tuple = True; vals = []
            i += 1; continue
        if c in ' \r\n\t':
            i += 1; continue
        if c == ')':
            rows.append(vals); in_tuple = False; i += 1; continue
        if c == ',':
            i += 1; continue
        if c == 'N' and i + 1 < n_ and text[i+1] == "'":
            i += 1; c = "'"
        if c == "'":
            i += 1; buf = []
            while i < n_:
                if text[i] == "'":
                    if i + 1 < n_ and text[i+1] == "'":
                        buf.append("'"); i += 2; continue
                    i += 1; break
                buf.append(text[i]); i += 1
            vals.append(''.join(buf)); continue
        # 普通 token:标识符/数字/函数;遇到括号函数则吞到匹配的 ')'
        j = i
        while j < n_ and text[j] not in ',)':
            if text[j] == '(':
                depth = 0
                while j < n_:
                    if text[j] == '(': depth += 1
                    elif text[j] == ')':
                        depth -= 1
                        if depth == 0:
                            j += 1; break
                    j += 1
                break
            j += 1
        vals.append(text[i:j].strip()); i = j
    return rows
old_rows = []
inserts = list(re.finditer(r'INSERT INTO dbo\.bs_asm_bom \(([^)]*)\) VALUES', old_sql))
assert old_cols == [c.strip() for c in inserts[0].group(1).split(',')], '列清单不一致'
for mi, m in enumerate(inserts):
    end = inserts[mi + 1].start() if mi + 1 < len(inserts) else len(old_sql)
    seg = old_sql[m.end():end]
    seg = seg.split('GO')[0]  # 只取本条 INSERT 的 VALUES 区
    for vals in parse_vals(seg):
        if len(vals) != len(old_cols):
            p('  [WARN] 旧脚本解析列数不符: %d vs %d vals=%s' % (len(vals), len(old_cols), vals))
            continue
        old_rows.append(dict(zip(old_cols, vals)))
for _r in old_rows:
    for _k, _v in list(_r.items()):
        if _v == 'NULL':
            _r[_k] = None
# 去掉 N 前缀处理的副产物: 'N' 后面直接字符串已合并;数字/关键字原样
p('旧脚本解析行数 = %d, 单据 = %d, 产品 = %d' % (len(old_rows), len({r['单据编号'] for r in old_rows}), len({r['产品编码'] for r in old_rows})))
old_keys = {(r['单据编号'], int(r['行序'])) for r in old_rows}
p('旧脚本键(单号,行序)在现库中存在数 = %d/%d, 缺失=%s' % (
   sum(1 for k in old_keys if k in dbk), len(old_keys), sorted(k for k in old_keys if k not in dbk)[:5]))
old_diff = defaultdict(list)
check_fields = ['产品编码','产品名称','规格型号','工序','版本号','默认BOM','工艺路线名称','来源','状态','子件编码','子件名称','子件规格','标准用量','用量分子','用量分母','损耗量','行备注','asp_user1','asp_user2','asp_time2','asp_cancel']
for o in old_rows:
    k = (o['单据编号'], int(o['行序']))
    r = dbk.get(k)
    if r is None: continue
    for f in check_fields:
        ov = o[f]
        if f in ('标准用量','用量分子','用量分母','损耗量'):
            if not eq_num(r[f], ov): old_diff[f].append((k, ov, r[f]))
        elif f in ('行序',):
            if int(r[f]) != int(ov): old_diff[f].append((k, ov, r[f]))
        else:
            if r[f] != ov: old_diff[f].append((k, ov, r[f]))
for k in ('备注', '计量单位'):
    pass
# 备注:旧脚本无此列 -> NULL;新库有值(金蝶 BOM 级备注)
remark_changed = [(k, r['备注']) for k, r in dbk.items() if k in old_keys and r['备注'] is not None]
p('旧键中 备注 由 NULL 变为非空 = %d 行(全量脚本新增 BOM 级备注字段,属口径增强)' % len(remark_changed))
unit_changed = []
for o in old_rows:
    k = (o['单据编号'], int(o['行序']))
    r = dbk.get(k)
    if r is None: continue
    if o['计量单位'] == 'NULL':
        e = next(x for x in erows if key(x) == k)
        exp = sorted(inv[e['子件编码']])[0] if e['子件编码'] in inv else e['分子单位']
        if r['计量单位'] != exp:
            unit_changed.append((k, exp, r['计量单位']))
p('旧键中 计量单位 与「档案优先/Excel分子单位兜底」不符 = %d 行' % len(unit_changed))
for k in old_diff:
    p('  旧键差异 %-12s %d 条; 例: %s' % (k, len(old_diff[k]), old_diff[k][:3]))
p('旧键逐字段(不含 备注/计量单位,旧脚本这两列口径不同)零差异 = %s' % (not old_diff))
# 旧脚本选块 vs 新 Excel:确认旧键的块都在 Excel 中
p('旧脚本 236 单是否都存在于 Excel 单据集合 = %s; 旧脚本行是否都是 Excel 行 = %s' % (
   {o['单据编号'] for o in old_rows} <= docs_ex, old_keys <= {key(e) for e in erows}))

with open(BASE + r'\out-compare-A-B-E1.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(OUT) + '\n')
print('[saved] out-compare-A-B-E1.txt')
