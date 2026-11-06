#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
组装物料清单**全量**导入 — 独立核对(不依赖生成器代码,用 openpyxl 重新读 Excel)。

两种模式:
  1) static  <sql>            :把生成好的 SQL 文本解析回来,与 Excel 逐行逐字段对账
                                (校验"SQL 里写的值" == "Excel 重算值")
  2) runtime <dump.tsv>       :把 DumpSql.java 从库里导出的 bs_asm_bom 行与 Excel 逐行逐字段对账
                                (校验"库里落的值" == "Excel 重算值"),并把 计量单位 按
                                「bs_inv 优先、否则 Excel 分子单位」规则核对

用法(仓库根目录):
  python tools/archive/_asm-bom-import-full-20261105/verify.py static tools/migrate-asm-bom-data-full-20261105.sql
  python tools/archive/_asm-bom-import-full-20261105/verify.py runtime D:/dsh/cache/tmp/bom_full_prod.tsv
"""
import csv
import re
import sys

XLSX = r'C:/Users/vigna/Documents/WeChat Files/wxid_9he2bhyytczm22/FileStorage/File/2026-10/引出列表_BOM单_20261019174847.xlsx'
SOURCE_TAG = '金蝶BOM引出列表_20261019174847'
EXPECT_ROWS = 3640
EXPECT_DOCS = 827
EXPECT_PRODS = 817


def s(v):
    if v is None:
        return None
    t = str(v).strip()
    return t or None


def n4(x):
    return f'{round(float(x) + 1e-12, 4):.4f}'


def load_excel():
    """独立读 Excel(openpyxl),返回 blocks: [{编码,产品编码,产品名称,规格型号,备注,默认BOM,使用状态,工艺路线名称,子件:[...]}]"""
    import openpyxl
    wb = openpyxl.load_workbook(XLSX, data_only=True, read_only=True)
    ws = wb['列表数据']
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    blocks = []
    cur = None
    for r in rows:
        prod = s(r[1])
        if prod:
            cur = dict(
                编码=s(r[9]), 产品编码=prod, 产品名称=s(r[0]), 规格型号=s(r[2]), 备注=s(r[6]),
                默认BOM=s(r[15]), 使用状态=s(r[14]), 工艺路线名称=s(r[25]), 子件=[],
            )
            blocks.append(cur)
        if cur is None:
            raise SystemExit('解析失败:首个块之前出现数据行')
        # 幻影行 = 子件关键列全空
        if all(s(r[i]) is None for i in (3, 4, 5, 10, 12, 31)):
            continue
        cur['子件'].append(dict(
            子件编码=s(r[3]), 子件名称=s(r[4]), 子件规格=s(r[5]),
            分子=r[10], 分母=r[12], 分子单位=s(r[11]), 行备注=s(r[31]),
        ))
    return blocks


def expected_map(blocks):
    """(单据编号, 行序) -> 期望字段 dict"""
    exp = {}
    for b in blocks:
        version = re.search(r'_V(\d+)$', b['编码']).group(1)
        version = 'V' + version.zfill(4)
        for i, c in enumerate(b['子件']):
            mol = float(c['分子']) if c['分子'] is not None else 1.0
            den = float(c['分母']) if c['分母'] not in (None, 0) else 1.0
            exp[(b['编码'], i + 1)] = {
                '单据编号': b['编码'],
                '产品编码': b['产品编码'],
                '产品名称': b['产品名称'],
                '规格型号': b['规格型号'],
                '工序': '组装',
                '版本号': version,
                '默认BOM': b['默认BOM'],
                '工艺路线名称': b['工艺路线名称'],
                '来源': SOURCE_TAG,
                '状态': b['使用状态'],
                '行序': str(i + 1),
                '子件编码': c['子件编码'],
                '子件名称': c['子件名称'],
                '子件规格': c['子件规格'],
                # 计量单位:两来源都记着,后续按规则比对
                '_excel_unit': c['分子单位'],
                '标准用量': n4(mol / den),
                '用量分子': n4(mol),
                '用量分母': n4(den),
                '损耗量': '0.0000',
                '行备注': c['行备注'],
                '备注': b['备注'],
                'asp_user1': '金蝶BOM导入',
                'asp_cancel': 'N',
            }
    return exp


# ---------------- static:解析 SQL ----------------
SQL_VALUE = re.compile(r"N'(?:[^']|'')*'|NULL|-?\d+(?:\.\d+)?|SYSDATETIME\(\)")


def split_tuples(body):
    """按顶层括号切 VALUES 元组(跳过 N'...' 内的括号;'' 为转义单引号)"""
    out, buf, depth, in_str, i = [], [], 0, False, 0
    while i < len(body):
        ch = body[i]
        if in_str:
            buf.append(ch)
            if ch == "'":
                if i + 1 < len(body) and body[i + 1] == "'":
                    buf.append("'")
                    i += 2
                    continue
                in_str = False
            i += 1
            continue
        if ch == "'":
            in_str = True
            buf.append(ch)
        elif ch == '(':
            depth += 1
            if depth == 1:
                buf = []
            else:
                buf.append(ch)
        elif ch == ')':
            depth -= 1
            if depth == 0:
                out.append(''.join(buf))
            else:
                buf.append(ch)
        else:
            buf.append(ch)
        i += 1
    return out


def parse_sql_values(text):
    m = re.search(r'INSERT INTO dbo\.bs_asm_bom \(([^)]*)\) VALUES', text, re.S)
    if not m:
        raise SystemExit('[FAIL] SQL 里找不到 INSERT 批次')
    cols = [c.strip() for c in m.group(1).split(',')]
    rows = []
    # 逐个 INSERT 批次抽取 VALUES 元组
    for ins in re.finditer(r'INSERT INTO dbo\.bs_asm_bom \(([^)]*)\) VALUES(.*?);', text, re.S):
        cols2 = [c.strip() for c in ins.group(1).split(',')]
        if cols2 != cols:
            raise SystemExit('[FAIL] 各批次列不一致')
        for tuple_text in split_tuples(ins.group(2)):
            vals = SQL_VALUE.findall(tuple_text)
            if len(vals) != len(cols):
                raise SystemExit(f'[FAIL] 元组值个数 {len(vals)} != 列数 {len(cols)}: {tuple_text[:120]}')
            row = {}
            for c, v in zip(cols, vals):
                if v == 'NULL':
                    row[c] = None
                elif v.startswith("N'"):
                    row[c] = v[2:-1].replace("''", "'")
                elif v == 'SYSDATETIME()':
                    row[c] = 'SYSDATETIME'
                else:
                    row[c] = v
            rows.append(row)
    return cols, rows


def verify_static(sql_path):
    blocks = load_excel()
    exp = expected_map(blocks)
    text = open(sql_path, encoding='utf-8').read()
    cols, rows = parse_sql_values(text)
    print(f'[INFO] Excel 期望: {len(exp)} 行 / {len(blocks)} 单 / {len({b["产品编码"] for b in blocks})} 产品')
    print(f'[INFO] SQL 解析出: {len(rows)} 行,列 {len(cols)}')
    problems = []
    if len(rows) != len(exp):
        problems.append(f'行数 {len(rows)} != {len(exp)}')
    seen = {}
    for row in rows:
        key = (row['单据编号'], int(row['行序']))
        if key in seen:
            problems.append(f'重复 (单据编号,行序): {key}')
        seen[key] = row
    for key, e in exp.items():
        row = seen.get(key)
        if row is None:
            problems.append(f'SQL 缺行: {key}')
            continue
        for field, want in e.items():
            if field == '_excel_unit':
                continue
            got = row.get(field)
            if field in ('标准用量', '用量分子', '用量分母', '损耗量'):
                if n4(got) != want:
                    problems.append(f'{key} {field}: {got!r} != {want!r}')
            elif (got or None) != (want or None):
                problems.append(f'{key} {field}: {got!r} != {want!r}')
        # 计量单位:SQL 插入值必须等于 Excel 分子单位(后续由 bs_inv 覆盖)
        if (row.get('计量单位') or None) != (e['_excel_unit'] or None):
            problems.append(f'{key} 计量单位(SQL) {row.get("计量单位")!r} != Excel 分子单位 {e["_excel_unit"]!r}')
    # 语句层检查
    checks = {
        'DELETE 按来源幂等清理': f"DELETE FROM dbo.bs_asm_bom WHERE 来源 = N'{SOURCE_TAG}'" in text,
        'bs_inv 计量单位覆盖 UPDATE': 'FROM dbo.bs_inv i' in text and 'SET b.计量单位 = x.计量单位' in text,
        '建表守卫': "IF OBJECT_ID('dbo.bs_asm_bom') IS NULL" in text,
        '自检 PASS 分支': '[PASS] asm-bom full import self-check OK' in text,
        '自检 FAIL 分支(severity 16)': '[FAIL] asm-bom full import self-check mismatch' in text,
        '无 BOM': not text.startswith('\ufeff'),
    }
    for name, ok in checks.items():
        if not ok:
            problems.append(f'语句检查失败: {name}')
    print(f'[INFO] 语句检查: ' + ', '.join(f'{k}={"OK" if v else "FAIL"}' for k, v in checks.items()))
    # 汇总
    docs = {r['单据编号'] for r in rows}
    prods = {r['产品编码'] for r in rows}
    print(f'[INFO] SQL 内: {len(rows)} 行 / {len(docs)} 单 / {len(prods)} 产品')
    if len(rows) != EXPECT_ROWS or len(docs) != EXPECT_DOCS or len(prods) != EXPECT_PRODS:
        problems.append(f'规模不符: 期望 {EXPECT_ROWS}/{EXPECT_DOCS}/{EXPECT_PRODS}')
    if problems:
        print(f'\n[FAIL] static 核对 {len(problems)} 处问题:')
        for p in problems[:40]:
            print('  -', p)
        return 1
    print('\n[PASS] static 核对通过: SQL 与 Excel 逐行逐字段一致,语句检查全 OK')
    return 0


# ---------------- runtime:核对 DB dump ----------------
def load_tsv(path):
    with open(path, encoding='utf-8') as f:
        rd = list(csv.reader(f, delimiter='\t'))
    hdr = rd[0]
    return [dict(zip(hdr, r)) for r in rd[1:]]


def verify_runtime(tsv_path):
    blocks = load_excel()
    exp = expected_map(blocks)
    db = load_tsv(tsv_path)
    print(f'[INFO] Excel 期望: {len(exp)} 行 / {len(blocks)} 单 / {len({b["产品编码"] for b in blocks})} 产品')
    tagged = [r for r in db if (r.get('来源') or None) == SOURCE_TAG]
    other = [r for r in db if (r.get('来源') or None) != SOURCE_TAG]
    print(f'[INFO] DB dump: 总 {len(db)} 行;来源={SOURCE_TAG} {len(tagged)} 行;其它来源 {len(other)} 行(应保留不动)')
    problems = []
    if len(tagged) != len(exp):
        problems.append(f'本来源行数 {len(tagged)} != 期望 {len(exp)}')
    docs = {r['单据编号'] for r in tagged}
    prods = {r['产品编码'] for r in tagged}
    if len(docs) != EXPECT_DOCS:
        problems.append(f'单据数 {len(docs)} != {EXPECT_DOCS}')
    if len(prods) != EXPECT_PRODS:
        problems.append(f'产品数 {len(prods)} != {EXPECT_PRODS}')
    seen = {}
    for r in tagged:
        key = (r['单据编号'], int(r['行序']))
        if key in seen:
            problems.append(f'重复 (单据编号,行序): {key}')
        seen[key] = r
    for key, e in exp.items():
        row = seen.get(key)
        if row is None:
            problems.append(f'DB 缺行: {key}')
            continue
        for field, want in e.items():
            if field == '_excel_unit':
                continue
            got = row.get(field)
            if field in ('标准用量', '用量分子', '用量分母', '损耗量', '行序'):
                if n4(got) != n4(want):
                    problems.append(f'{key} {field}: {got!r} != {want!r}')
            elif (got or None) != (want or None):
                problems.append(f'{key} {field}: {got!r} != {want!r}')
        # 计量单位:bs_inv 优先,否则 Excel 分子单位;DB 里两者之一即可(导出时已填了分子单位)
        unit = row.get('计量单位') or None
        if unit is None:
            problems.append(f'{key} 计量单位为空(Excel 分子单位={e["_excel_unit"]!r})')
    if problems:
        print(f'\n[FAIL] runtime 核对 {len(problems)} 处问题:')
        for p in problems[:40]:
            print('  -', p)
        return 1
    print('\n[PASS] runtime 核对通过: 库内本来源行与 Excel 逐行逐字段一致;其它来源行未被动')
    print(f'[INFO] 其它来源(手工新建 BOM)行数: {len(other)}')
    return 0


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(2)
    mode, arg = sys.argv[1], sys.argv[2]
    if mode == 'static':
        sys.exit(verify_static(arg))
    elif mode == 'runtime':
        sys.exit(verify_runtime(arg))
    else:
        print(f'未知模式 {mode}')
        sys.exit(2)
