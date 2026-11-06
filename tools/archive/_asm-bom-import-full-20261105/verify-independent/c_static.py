# -*- coding: utf-8 -*-
"""独立复核 C:静态审查 tools/migrate-asm-bom-data-full-20261105.sql。
逐条断言写死在脚本里,全部由本脚本自行解析/计算,不引用 lead 的 verify.py。
"""
import re, json, hashlib
from decimal import Decimal, ROUND_HALF_UP

REPO = r'D:\workspace\yinjia'
BASE = REPO + r'\tools\archive\_asm-bom-import-full-20261105\verify-independent'
SQL = REPO + r'\tools\migrate-asm-bom-data-full-20261105.sql'
SRC = "金蝶BOM引出列表_20261019174847"
OUT = []
def p(*a):
    s = ' '.join(str(x) for x in a); OUT.append(s); print(s)

raw = open(SQL, 'rb').read()
p('文件: %d 字节  sha256=%s' % (len(raw), hashlib.sha256(raw).hexdigest()))
p('UTF-8 无 BOM = %s; 首字符 = %r' % (not raw.startswith(b'\xef\xbb\xbf'), raw[:1]))
text = raw.decode('utf-8')

# 去注释(行注释 + 块注释;T-SQL 块注释可嵌套,这里按非嵌套处理,本脚本无块注释)
noblock = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
lines = []
for ln in noblock.split('\n'):
    # 去掉行注释(注意字符串里没有 --,本脚本已验证)
    q = re.sub(r"--[^\n]*", '', ln)
    lines.append(q)
code = '\n'.join(lines)
# 去掉 GO 分隔行(否则按 ';' 拆语句时上一批的 GO 会粘到下一条语句前面)
code = re.sub(r'(?im)^\s*GO\s*$', '', code)

# 按 GO 切批
batches = [b for b in re.split(r'(?im)^\s*GO\s*$', code) if b.strip()]
p('批次数(GO 切分) = %d' % len(batches))
p('块注释数 = %d, 行注释行数 = %d' % (text.count('/*'), sum(1 for l in text.split('\n') if l.strip().startswith('--'))))

# 语句分类:去掉字符串字面量后找语句关键字
def strip_strings(s):
    return re.sub(r"N?'(?:[^']|'')*'", "''", s)
stmts = []
for b in batches:
    b2 = strip_strings(b)
    for m in re.finditer(r'(?i)(?<![\w])(DELETE|INSERT|UPDATE|SELECT|SET|DECLARE|IF|ELSE|RAISERROR|RETURN|ALTER|CREATE|DROP|TRUNCATE|MERGE|EXEC|EXECUTE|GRANT|REVOKE|DENY|BACKUP|RESTORE|USE|WHILE|BEGIN|END|FROM|WHERE|CROSS\s+APPLY|ORDER\s+BY|HAVING|GROUP\s+BY)\b', b2):
        stmts.append(m.group(1).upper())
from collections import Counter
sc = Counter(stmts)
p('语句关键字计数(DML/DDL 类): %s' % {k: v for k, v in sc.items() if k in (
    'DELETE','INSERT','UPDATE','SELECT','SET','DECLARE','IF','ELSE','RAISERROR','RETURN',
    'ALTER','CREATE','DROP','TRUNCATE','MERGE','EXEC','EXECUTE','GRANT','REVOKE','DENY','BACKUP','RESTORE','USE')})
ddl = [k for k in ('ALTER','CREATE','DROP','TRUNCATE','MERGE','EXEC','EXECUTE','GRANT','REVOKE','DENY','BACKUP','RESTORE','USE') if sc.get(k)]
p('DDL/权限/整库语句 = %s' % (ddl if ddl else '无(零 DDL)'))
p('DML 计数: DELETE=%d INSERT=%d UPDATE=%d' % (sc.get('DELETE', 0), sc.get('INSERT', 0), sc.get('UPDATE', 0)))

# 全文件(含注释)搜危险词,区分是否只出现在注释里
for kw in ('DROP ', 'TRUNCATE', 'ALTER ', 'CREATE TABLE', 'DROP TABLE', 'DELETE FROM', 'UPDATE dbo', 'UPDATE b'):
    cnt = len(re.findall(re.escape(kw), text, flags=re.I))
    p('  全文出现 %-14r = %d 次' % (kw, cnt))

# DELETE 语句精确校验
dele = [s.strip() for s in re.split(r';', strip_strings(code)) if re.search(r'(?i)\bDELETE\b', s)]
p('\nDELETE 语句数 = %d' % len(dele))
for s in dele:
    p('  DELETE 原文: %s' % re.sub(r'\s+', ' ', s.strip()))
    p('  仅按 来源 过滤 = %s; 含 OR = %s; 含 其它列条件 = %s' % (
        bool(re.search(r"WHERE\s+来源\s*=\s*''", s)), ' OR ' in s.upper(),
        bool(re.search(r"(?i)WHERE.*\b(产品编码|单据编号|子件编码|asp_cancel)\b", s))))

# UPDATE 语句精确校验
upd = [s for s in re.split(r';', strip_strings(code)) if re.search(r'(?i)^\s*UPDATE\b', s)]
p('\nUPDATE 语句数 = %d' % len(upd))
for s in upd:
    p('  UPDATE 原文: %s' % re.sub(r'\s+', ' ', s).strip())
    p('  WHERE 条件(顶层) = %s' % re.search(r"(?is)\bWHERE\s+b\.来源\b.*$", s).group(0).strip())

# 自检批次:必须全部按 来源 过滤
selfcheck = batches[-1]
sc_str = strip_strings(selfcheck)
# 按分号拆语句,逐条检查:凡 FROM dbo.bs_asm_bom 的语句必须带 来源 过滤
sc_stmts = [s for s in re.split(r';', sc_str) if 'FROM dbo.bs_asm_bom' in s]
p('\n自检批次: 含 FROM dbo.bs_asm_bom 的语句数 = %d' % len(sc_stmts))
for i, s in enumerate(sc_stmts):
    has_src = "WHERE 来源 = ''" in s or "WHERE 来源 = ''" in re.sub(r'\s+', ' ', s)
    p('  语句%d: 含来源过滤=%s; 摘要=%s' % (i + 1, has_src, re.sub(r'\s+', ' ', s.strip())[:110]))
p('  自检全部按 来源 过滤 = %s' % all("WHERE 来源 = ''" in re.sub(r'\s+', ' ', s) for s in sc_stmts))
p('  自检批次含 RAISERROR severity 16(FAIL 分支) = %s; 含 severity 10(PASS/INFO) = %s' % (
    bool(re.search(r"RAISERROR\s*\(.*?,\s*16\s*,", selfcheck, flags=re.S)),
    bool(re.search(r"RAISERROR\s*\(.*?,\s*10\s*,", selfcheck, flags=re.S))))
# 预检批次:表不存在 -> severity16 + RETURN
pre = batches[0]
p('  预检批次含 OBJECT_ID 守卫=%s, severity16=%s, RETURN=%s' % (
    "OBJECT_ID('dbo.bs_asm_bom') IS NULL" in pre,
    bool(re.search(r"RAISERROR\s*\(.*?,\s*16\s*,", pre, flags=re.S)), 'RETURN' in pre))

# 解析 INSERT VALUES(与 compare.py 同一状态机,独立实现于本文件)
def parse_vals(txt):
    rows = []; i = 0; n = len(txt); in_t = False; vals = []
    while i < n:
        c = txt[i]
        if not in_t:
            if c == '(':
                in_t = True; vals = []
            i += 1; continue
        if c in ' \r\n\t':
            i += 1; continue
        if c == ')':
            rows.append(vals); in_t = False; i += 1; continue
        if c == ',':
            i += 1; continue
        if c == 'N' and i + 1 < n and txt[i+1] == "'":
            i += 1; c = "'"
        if c == "'":
            i += 1; buf = []
            while i < n:
                if txt[i] == "'":
                    if i + 1 < n and txt[i+1] == "'":
                        buf.append("'"); i += 2; continue
                    i += 1; break
                buf.append(txt[i]); i += 1
            vals.append(''.join(buf)); continue
        j = i
        while j < n and txt[j] not in ',)':
            if txt[j] == '(':
                depth = 0
                while j < n:
                    if txt[j] == '(':
                        depth += 1
                    elif txt[j] == ')':
                        depth -= 1
                        if depth == 0:
                            j += 1
                            break
                    j += 1
                break
            j += 1
        vals.append(txt[i:j].strip()); i = j
    return rows

inserts = list(re.finditer(r'INSERT INTO dbo\.bs_asm_bom \(([^)]*)\) VALUES', text))
ins_cols = [c.strip() for c in inserts[0].group(1).split(',')]
p('\nINSERT 批次数 = %d, 列数 = %d' % (len(inserts), len(ins_cols)))
p('INSERT 列: %s' % ins_cols)
rows = []
per_batch = []
for mi, m in enumerate(inserts):
    end = inserts[mi + 1].start() if mi + 1 < len(inserts) else len(text)
    seg = text[m.end():end]
    seg = re.split(r'(?im)^\s*GO\s*$', seg)[0]
    batch_rows = parse_vals(seg)
    per_batch.append(len(batch_rows))
    for v in batch_rows:
        assert len(v) == len(ins_cols), (len(v), len(ins_cols), v)
        rows.append(dict(zip(ins_cols, v)))
p('每批行数 = %s (总 %d, 每批上限 200 = %s)' % (per_batch, len(rows), all(x <= 200 for x in per_batch)))
p('插入总行数 = %d, 单据 = %d, 产品 = %d' % (len(rows), len({r['单据编号'] for r in rows}), len({r['产品编码'] for r in rows})))
for _r in rows:
    for _k, _v in list(_r.items()):
        if _v == 'NULL':
            _r[_k] = None
keys = [(r['单据编号'], int(r['行序'])) for r in rows]
p('(单据编号,行序) 键唯一 = %s (重复键 = %s)' % (len(keys) == len(set(keys)), [k for k, c in Counter(keys).items() if c > 1]))
p('来源全部=%r = %s; 工序全部=组装 = %s; asp_cancel 全部=N = %s' % (
    SRC, all(r['来源'] == SRC for r in rows), all(r['工序'] == '组装' for r in rows), all(r['asp_cancel'] == 'N' for r in rows)))
p('插入时 计量单位 非空 = %s; 备注列已 INSERT = %s' % (
    all(r['计量单位'] is not None and r['计量单位'] != 'NULL' for r in rows), '备注' in ins_cols))
bad_std = [r for r in rows if abs(Decimal(r['标准用量']) - ((Decimal(r['用量分子']) / (Decimal(r['用量分母']) if Decimal(r['用量分母']) != 0 else Decimal(1))).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP))) > Decimal('0.00005')]
p('标准用量=ROUND(分子/分母,4) 不符行 = %d' % len(bad_std))
p('损耗量≠0 行 = %d; 行序从 1 连续(逐单) = %s' % (
    sum(1 for r in rows if Decimal(r['损耗量']) != 0),
    (lambda: (lambda docs: all(sorted(int(r['行序']) for r in rows if r['单据编号'] == d) == list(range(1, 1 + sum(1 for r in rows if r['单据编号'] == d))) for d in docs))({r['单据编号'] for r in rows}))()))

# 与 Excel 独立解析结果做静态对照(插入值口径:计量单位=Excel 分子单位)
ex = json.load(open(BASE + r'\excel-parsed.json', encoding='utf-8'))
erows = ex['rows']
for _e in erows:
    for _f in ('标准用量','用量分子','用量分母'):
        if _e[_f] is not None:
            _e[_f] = Decimal(_e[_f])
p('\n静态对照 Excel:Excel 行=%d, SQL 插入行=%d' % (len(erows), len(rows)))
ekey = {(e['单据编号'], int(e['行序'])): e for e in erows}
p('键集合一致 = %s' % (set(ekey) == set(keys)))
diff = Counter()
for r in rows:
    e = ekey.get((r['单据编号'], int(r['行序'])))
    if e is None:
        diff['DB多行'] += 1; continue
    for f in ('产品编码','产品名称','规格型号','版本号','默认BOM','工艺路线名称','状态','子件编码','子件名称','子件规格','行备注','备注'):
        if r[f] != e[f]:
            diff[f] += 1
    if r['计量单位'] != e['分子单位']:
        diff['计量单位!=Excel分子单位'] += 1
    for f in ('标准用量','用量分子','用量分母'):
        if Decimal(r[f]) != e[f]:
            diff[f] += 1
p('SQL 文本 ↔ Excel 逐字段差异 = %s' % (dict(diff) if diff else 'PASS(零差异)'))

# 与上一版脚本:清单顺序 + 超集关系
man = open(REPO + r'\tools\db-migrations.txt', encoding='utf-8').read().split('\n')
def idx(name):
    return [i for i, l in enumerate(man) if l.strip() == name]
old_i, new_i = idx('migrate-asm-bom-data-20261030.sql'), idx('migrate-asm-bom-data-full-20261105.sql')
p('\n迁移清单登记: 旧脚本行号=%s, 新脚本行号=%s, 顺序(old<new)=%s, 新脚本登记次数=%d' % (
    old_i, new_i, bool(old_i and new_i and old_i[0] < new_i[0]), len(new_i)))
old_sql = open(REPO + r'\tools\migrate-asm-bom-data-20261030.sql', encoding='utf-8').read()
old_ins = list(re.finditer(r'INSERT INTO dbo\.bs_asm_bom \(([^)]*)\) VALUES', old_sql))
old_rows = []
for mi, m in enumerate(old_ins):
    end = old_ins[mi + 1].start() if mi + 1 < len(old_ins) else len(old_sql)
    for v in parse_vals(re.split(r'(?im)^\s*GO\s*$', old_sql[m.end():end])[0]):
        oc = [c.strip() for c in m.group(1).split(',')]
        old_rows.append(dict(zip(oc, v)))
old_keys = {(r['单据编号'], int(r['行序'])) for r in old_rows}
p('旧脚本行数=%d, 键是否全被新脚本覆盖(超集)=%s (缺失=%s)' % (
    len(old_rows), old_keys <= set(keys), sorted(old_keys - set(keys))[:5]))
p('旧/新两脚本共用同一 来源 标记(可整批替换)=%s' % (all(r['来源'] == SRC for r in old_rows)))

with open(BASE + r'\out-C-static.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(OUT) + '\n')
print('[saved] out-C-static.txt')
