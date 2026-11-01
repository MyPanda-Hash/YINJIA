# -*- coding: utf-8 -*-
"""静态核对:独立用 openpyxl 重算「组装物料清单」期望结果,并与生成的 SQL 逐行对账。
不连数据库,不修改任何文件;输出 PASS/FAIL 清单与抽查明细到 stdout(UTF-8)。
用法: python verify-static.py
"""
import json
import re
import sys
from decimal import Decimal, ROUND_HALF_UP

import openpyxl

ROOT = r"D:\workspace\yinjia"
ARCH = ROOT + r"\tools\archive\_asm-bom-import-20261030"
XLSX = r"C:\Users\vigna\Documents\WeChat Files\wxid_9he2bhyytczm22\FileStorage\File\2026-10\引出列表_BOM单_20261019174847.xlsx"
SQL = ROOT + r"\tools\migrate-asm-bom-data-20261030.sql"
PROD_TXT = ARCH + r"\in-production-products.txt"
SOURCE = "金蝶BOM引出列表_20261019174847"
D = Decimal

fails = []
def check(ok, label, detail=""):
    print(("[PASS] " if ok else "[FAIL] ") + label + ((" — " + detail) if detail else ""))
    if not ok:
        fails.append(label + (" — " + detail if detail else ""))
    return ok

def norm(v):
    if v is None:
        return None
    if isinstance(v, str):
        t = v.strip()
        return t or None
    return v

# ---------- 1. 独立解析 Excel ----------
wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
ws = wb["列表数据"]
raw = list(ws.iter_rows(min_row=2, values_only=True))
blocks = []
cur = None
ncols = ws.max_column
for r in raw:
    def g(c):
        return norm(r[c - 1]) if c - 1 < len(r) else None
    if g(2) is not None:
        cur = {"产品编码": g(2), "产品名称": g(1), "规格型号": g(3), "编码": g(10),
               "默认BOM": g(16), "使用状态": g(15), "工艺路线名称": g(26), "子件": []}
        blocks.append(cur)
    if cur is None:
        raise SystemExit("Excel 首行无产品编码,解析失败")
    cur["子件"].append({"物料编码": g(4), "物料名称": g(5), "子件规格": g(6),
                        "分子": g(11), "分母": g(13), "行备注": g(32)})

excel_products = {b["产品编码"] for b in blocks}
prod = [ln.strip() for ln in open(PROD_TXT, encoding="utf-8").read().splitlines() if ln.strip()]
prod_set = set(prod)
inter = sorted(prod_set & excel_products)

print("=== 基础量 ===")
print(f"Excel 数据行={len(raw)} BOM块={len(blocks)} 父产品={len(excel_products)} 列数={ncols}")
print(f"在产产品={len(prod_set)} 交集={len(inter)} 在产无BOM={len(prod_set - excel_products)}")
check(len(blocks) == 827, "Excel BOM 块数 = 827", str(len(blocks)))
check(len(raw) == 3641, "Excel 数据行 = 3641", str(len(raw)))
check(len(excel_products) == 817, "Excel 父产品数 = 817", str(len(excel_products)))
check(len(prod_set) == 244, "DB 在产产品数 = 244", str(len(prod_set)))
check(len(inter) == 236, "交集产品数 = 236", str(len(inter)))

# ---------- 2. 独立选块 ----------
def ver_num(code):
    m = re.search(r"_V(\d+)$", code)
    return int(m.group(1)) if m else -1

by_product = {}
for b in blocks:
    by_product.setdefault(b["产品编码"], []).append(b)

selected = {}
skipped = []
for p in inter:
    cand = by_product[p]
    cand_sorted = sorted(cand, key=lambda b: (0 if b["默认BOM"] == "是" else 1, -ver_num(b["编码"])))
    selected[p] = cand_sorted[0]
    skipped += [b["编码"] for b in cand_sorted[1:]]

exp_rows = []       # 期望的每一行(按选出块顺序)
for p in inter:
    b = selected[p]
    for i, c in enumerate(b["子件"], 1):
        mol = D(str(c["分子"])) if c["分子"] is not None else D(1)
        den = D(str(c["分母"])) if c["分母"] is not None else D(1)
        if den == 0:
            den = D(1)
        std = (mol / den).quantize(D("0.0001"), ROUND_HALF_UP)
        exp_rows.append({
            "单据编号": b["编码"], "产品编码": p, "产品名称": b["产品名称"], "规格型号": b["规格型号"],
            "工序": "组装", "版本号": "V" + b["编码"].split("_V")[-1],
            "默认BOM": b["默认BOM"], "工艺路线名称": b["工艺路线名称"], "来源": SOURCE,
            "状态": b["使用状态"], "行序": i,
            "子件编码": c["物料编码"], "子件名称": c["物料名称"], "子件规格": c["子件规格"],
            "标准用量": std, "用量分子": mol, "用量分母": den, "行备注": c["行备注"],
        })

print("=== 期望输出 ===")
print(f"选中产品={len(selected)} 单据={len({b['编码'] for b in selected.values()})} 总行数={len(exp_rows)} 跳过块={skipped}")
check(len(selected) == 236, "期望选中产品数 = 236", str(len(selected)))
check(len(exp_rows) == 1085, "期望总行数 = 1085", str(len(exp_rows)))
check(sorted(skipped) == ["D-01-49_V0001", "S051-2_V0001"], "跳过多版本块 = [D-01-49_V0001, S051-2_V0001]", str(skipped))

# ---------- 3. 解析生成的 SQL ----------
text = open(SQL, "rb").read()
if text[:3] == b"\xef\xbb\xbf":
    raise SystemExit("[FAIL] SQL 带 UTF-8 BOM")
check(True, "SQL 为 UTF-8 无 BOM", f"{len(text)} bytes")
sql = text.decode("utf-8")

mcols = re.search(r"INSERT INTO dbo\.bs_asm_bom\s*\(([^)]*)\)\s*VALUES", sql)
check(bool(mcols), "找到 INSERT INTO dbo.bs_asm_bom 列清单")
batches = list(re.finditer(r"INSERT INTO dbo\.bs_asm_bom\s*\(([^)]*)\)\s*VALUES", sql))
check(len(batches) >= 1, "INSERT 批次数量", str(len(batches)))
col_list = [c.strip() for c in batches[0].group(1).split(",")]
EXPECT_COLS = ["单据编号", "产品编码", "产品名称", "规格型号", "工序", "版本号", "默认BOM", "工艺路线名称",
               "来源", "状态", "行序", "子件编码", "子件名称", "子件规格", "计量单位", "标准用量",
               "用量分子", "用量分母", "损耗量", "行备注", "asp_user1", "asp_time1", "asp_user2",
               "asp_time2", "asp_cancel"]
check(col_list == EXPECT_COLS, "INSERT 列清单与约定一致", "实际=" + ",".join(col_list))

del_idx = sql.find("DELETE FROM dbo.bs_asm_bom")
ins_idx = sql.find("INSERT INTO dbo.bs_asm_bom")
check(0 <= del_idx < ins_idx, "DELETE(幂等清理)位于 INSERT 之前",
      f"delete@{del_idx} insert@{ins_idx}")
m = re.search(r"DELETE FROM dbo\.bs_asm_bom WHERE 来源 = N'([^']*)'", sql)
check(bool(m) and m.group(1) == SOURCE, "DELETE 仅按 来源 = 本次来源 过滤",
      m.group(1) if m else "未匹配")
check(sql.count("DELETE FROM dbo.bs_asm_bom") == 1, "脚本中只有一条 DELETE", str(sql.count("DELETE FROM dbo.bs_asm_bom")))
check("UPDATE b" in sql and "WHERE b.来源 = N'" + SOURCE in sql, "计量单位 UPDATE 带 来源 过滤")

# --- mini SQL VALUES 解析器 ---
def parse_values(s, start):
    """从 start(指向 VALUES 后第一个 '(')解析 (..),(..),..; 返回行列表(list of str tokens)与结束位置"""
    rows = []
    i = start
    n = len(s)
    while i < n:
        while i < n and s[i] in " \t\r\n,":
            i += 1
        if i >= n or s[i] == ";":
            break
        assert s[i] == "(", f"解析失败 @{i}: {s[i:i+30]!r}"
        i += 1
        fields = []
        buf = []
        while True:
            while i < n and s[i] in " \t\r\n":
                i += 1
            if i >= n:
                raise AssertionError("VALUES 未闭合")
            ch = s[i]
            if ch == "N" and s[i + 1] == "'":
                i += 2
                out = []
                while True:
                    if s[i] == "'":
                        if s[i + 1] == "'":
                            out.append("'")
                            i += 2
                        else:
                            i += 1
                            break
                    else:
                        out.append(s[i])
                        i += 1
                fields.append(("str", "".join(out)))
            else:
                j = i
                depth = 0
                while j < n:
                    ch2 = s[j]
                    if ch2 == "(":
                        depth += 1
                    elif ch2 == ")":
                        if depth == 0:
                            break
                        depth -= 1
                    elif ch2 == "," and depth == 0:
                        break
                    j += 1
                tok = s[i:j].strip()
                fields.append(("raw", tok))
                i = j
            while i < n and s[i] in " \t\r\n":
                i += 1
            if i < n and s[i] == ",":
                i += 1
                continue
            if i < n and s[i] == ")":
                i += 1
                break
            raise AssertionError(f"字段分隔异常 @{i}: {s[i:i+20]!r}")
        rows.append(fields)
        while i < n and s[i] in " \t\r\n":
            i += 1
        if i < n and s[i] == ";":
            i += 1
            break
    return rows, i

sql_rows = []
for bm in batches:
    part_rows, _ = parse_values(sql, bm.end())
    sql_rows += part_rows
check(len(sql_rows) == len(exp_rows), f"SQL 插入行数 = {len(exp_rows)}", str(len(sql_rows)))
check(all(len(r) == 25 for r in sql_rows), "每行 25 个字段", str(set(len(r) for r in sql_rows)))

def tok(r, name):
    v = r[EXPECT_COLS.index(name)]
    return v

def numval(t):
    return None if t[1] == "NULL" else Decimal(t[1])

# ---------- 4. 逐行对账(按 单据编号+行序 配对,行序与 SQL 物理顺序无关) ----------
exp_map = {(e["单据编号"], e["行序"]): e for e in exp_rows}
sql_map = {}
dup_keys = []
for r in sql_rows:
    k = (tok(r, "单据编号")[1], int(tok(r, "行序")[1]))
    if k in sql_map:
        dup_keys.append(k)
    sql_map[k] = r
check(not dup_keys, "SQL 中 (单据编号,行序) 无重复", str(dup_keys[:5]))
check(set(sql_map) == set(exp_map), "行集合(单据编号+行序) = Excel 期望",
      f"SQL 独有 {len(set(sql_map)-set(exp_map))}, 期望独有 {len(set(exp_map)-set(sql_map))}")

mismatch = []
for key in sorted(exp_map):
    e = exp_map[key]
    r = sql_map.get(key)
    if r is None:
        mismatch.append((key, ["缺失"]))
        continue
    def eq_str(name):
        t = tok(r, name)
        actual = None if t[1] == "NULL" else t[1]
        return actual == e[name]
    def eq_num(name):
        t = tok(r, name)
        actual = numval(t)
        return actual is not None and actual == e[name]
    errs = []
    for nm in ("产品编码", "产品名称", "规格型号", "工序", "版本号", "默认BOM",
               "工艺路线名称", "来源", "状态", "子件编码", "子件名称", "子件规格", "行备注"):
        if not eq_str(nm):
            errs.append(f"{nm}: SQL={tok(r,nm)} Excel={e[nm]!r}")
    for nm in ("标准用量", "用量分子", "用量分母"):
        if not eq_num(nm):
            errs.append(f"{nm}: SQL={tok(r,nm)} expect={e[nm]}")
    if tok(r, "损耗量")[1] != "0.0000":
        errs.append("损耗量 != 0.0000")
    if tok(r, "计量单位")[1] != "NULL":
        errs.append("计量单位 插入时应为 NULL")
    if tok(r, "asp_user1") != ("str", "金蝶BOM导入"):
        errs.append("asp_user1 != 金蝶BOM导入")
    if tok(r, "asp_time1")[1] != "SYSDATETIME()":
        errs.append("asp_time1 != SYSDATETIME()")
    if tok(r, "asp_cancel") != ("str", "N"):
        errs.append("asp_cancel != N")
    if errs:
        mismatch.append((key, errs[:4]))
check(len(mismatch) == 0, "1085 行逐行对账(全字段,按 单据编号+行序 配对)", f"{len(mismatch)} 行不符;样例 {mismatch[:3]}")

# ---------- 5. 结构自检 ----------
docs = {}
for r in sql_rows:
    docs.setdefault(tok(r, "单据编号")[1], []).append(r)
check(len(docs) == 236, "单据数 = 236", str(len(docs)))
seq_ok = all([tok(r, "行序")[1] for r in rows] == [str(i) for i in range(1, len(rows) + 1)] for rows in docs.values())
check(seq_ok, "每个单据 行序 为 1..n 连续")
check(all(len({tok(r, "产品编码")[1] for r in rows}) == 1 for rows in docs.values()), "每张单据只有一个产品编码")
check(all(len({tok(r, "版本号")[1] for r in rows}) == 1 and tok(rows[0], "单据编号")[1].endswith("_" + tok(rows[0], "版本号")[1]) for rows in docs.values()),
      "单据编号后缀 = 版本号")
check({tok(r, "产品编码")[1] for r in sql_rows} == set(inter), "产品集合 = 在产∩Excel(236 个)", )
check({tok(r, "来源")[1] for r in sql_rows} == {SOURCE}, "来源 全部为约定值")
check({tok(r, "工序")[1] for r in sql_rows} == {"组装"}, "工序 全部为 组装")
check({tok(r, "默认BOM")[1] for r in sql_rows} <= {"NULL", "是", "否"}, "默认BOM 取值合法")
nonunit = sum(1 for r in sql_rows if tok(r, "计量单位")[1] == "NULL")
check(nonunit == len(sql_rows), "插入时 计量单位 全部为空(等待 bs_inv 回填)", str(nonunit))

# 在产无BOM 8 个不得出现
prod_no_bom = prod_set - excel_products
check(not (prod_no_bom & {tok(r, "产品编码")[1] for r in sql_rows}), "在产无BOM的 8 个产品未被造行")

# ---------- 6. 抽查 5 个产品 ----------
SAMPLE = ["A-32-09", "A-42-04", "D-01-49", "S051-2", "T201"]
print("\n=== 抽查 5 个产品 ===")
for p in SAMPLE:
    b = selected.get(p)
    if b is None:
        check(False, f"抽查产品 {p} 不在交集中")
        continue
    rows = docs.get(b["编码"], [])
    expect_n = len(b["子件"])
    ok = len(rows) == expect_n
    usage = []
    for r in rows:
        mol = numval(tok(r, "用量分子"))
        den = numval(tok(r, "用量分母"))
        std = numval(tok(r, "标准用量"))
        ok = ok and std == (mol / den).quantize(D("0.0001"), ROUND_HALF_UP)
        usage.append(f"{tok(r,'子件编码')[1]} {mol}/{den}={std}")
    print(f"  {p} -> {b['编码']} 子件数 SQL={len(rows)} Excel={expect_n} | 用量: " + "; ".join(usage[:3]))
    check(ok, f"抽查 {p} 子件数/标准用量对账", f"SQL={len(rows)} Excel={expect_n}")

# ---------- 7. 报告一致性 ----------
rep = json.load(open(ARCH + r"\gen-report.json", encoding="utf-8"))
check(rep["输出"]["总行数"] == len(sql_rows), "gen-report 总行数与 SQL 一致")
check(rep["输出"]["跳过块数"] == len(skipped), "gen-report 跳过块数与独立重算一致")
check(rep["范围"]["在产无BOM产品"] == sorted(prod_no_bom), "gen-report 在产无BOM清单一致")

print("\n=== 结论 ===")
if fails:
    print(f"[FAIL] 静态核对不通过,共 {len(fails)} 项:")
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("[PASS] 静态核对全部通过(独立 openpyxl 重算 vs 生成 SQL 逐行一致)")
