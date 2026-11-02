#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
T3 独立验收:B 数据与 Excel 源表独立对账(不复用 T2 生成器逻辑,按验收口径重算)。
输入:
  - Excel: 引出列表_BOM单_20261019174847.xlsx(sheet 列表数据)
  - DB dump: B-dump-<DB>.txt(Q.java 输出)
  - plang 在产清单: B-plang-HSDZ_MES.txt(Q.java 输出)
输出:
  - reconcile-report.json / reconcile-report.txt
"""
import json
import random
import re
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from openpyxl import load_workbook

HERE = Path(__file__).resolve().parent
XLSX = Path(r"C:\Users\vigna\Documents\WeChat Files\wxid_9he2bhyytczm22\FileStorage\File\2026-10\引出列表_BOM单_20261019174847.xlsx")
SAMPLE_FIXED = ["A-32-09", "A-42-04", "D-01-49", "S051-2", "T201"]
NO_BOM_8 = ["A-32-13", "A-32-17", "A-32-26", "B-65-04", "C-95-32", "D-01-18", "S092-2", "T042-6"]


def dec(v):
    if v is None or v == "":
        return None
    return Decimal(str(v))


def q4(num, den):
    """ROUND(分子/分母,4);分母空/0 按 1"""
    n = dec(num)
    d = dec(den)
    if n is None:
        n = Decimal(0)
    if d is None or d == 0:
        d = Decimal(1)
    return (n / d).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def ver_of(code):
    m = re.search(r"_V(\d+)$", code or "")
    return int(m.group(1)) if m else -1


def read_excel():
    wb = load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb["列表数据"]
    blocks = []
    cur = None
    rows = 0
    for r in ws.iter_rows(min_row=2, values_only=True):
        rows += 1
        if all(v is None for v in r):
            continue
        prod = r[1]  # c2 产品编码
        if prod not in (None, ""):
            cur = {
                "产品编码": str(prod).strip(),
                "产品名称": r[0],
                "规格型号": r[2],
                "bom": str(r[9]).strip() if r[9] not in (None, "") else "",
                "默认BOM": str(r[15]).strip() if r[15] not in (None, "") else "",
                "状态": r[14],
                "工艺路线名称": r[25],
                "来源行": [],
            }
            blocks.append(cur)
        if cur is None:
            continue
        cur["来源行"].append({
            "子件编码": str(r[3]).strip() if r[3] not in (None, "") else "",
            "子件名称": r[4],
            "子件规格": r[5],
            "单位": r[7],
            "用量分子": r[10],
            "用量分母": r[12],
            "行备注": r[31],
            "行序(块内)": len(cur["来源行"]) + 1,
        })
    wb.close()
    return blocks, rows


def read_dump(db):
    p = HERE / f"B-dump-{db}.txt"
    out = {}
    for ln in p.read_text(encoding="utf-8").splitlines():
        if not ln.startswith("DUMP | "):
            continue
        parts = ln[len("DUMP | "):].split("\t")
        if len(parts) < 14:
            raise SystemExit(f"dump 行字段数异常({len(parts)}): {ln[:120]}")
        rec = {
            "产品编码": parts[0], "单据编号": parts[1], "版本号": parts[2], "默认BOM": parts[3],
            "行序": int(parts[4]), "子件编码": parts[5], "子件名称": parts[6], "子件规格": parts[7],
            "计量单位": parts[8], "标准用量": parts[9], "用量分子": parts[10],
            "用量分母": parts[11], "损耗量": parts[12], "行备注": parts[13],
        }
        out.setdefault(rec["产品编码"], []).append(rec)
    for k in out:
        out[k].sort(key=lambda x: x["行序"])
    return out


def read_plang():
    p = HERE / "B-plang-HSDZ_MES.txt"
    prods = []
    for ln in p.read_text(encoding="utf-8").splitlines():
        if ln.startswith("distinct dm 非Y(清单) | "):
            prods.append(ln.split(" | ", 1)[1].strip())
    return prods


def choose_block(blocks):
    """每产品选一张:默认BOM=是 优先,否则 _V 数字最大"""
    by_prod = {}
    for b in blocks:
        by_prod.setdefault(b["产品编码"], []).append(b)
    chosen = {}
    for prod, bs in by_prod.items():
        defs = [b for b in bs if b["默认BOM"] == "是"]
        if defs:
            chosen[prod] = max(defs, key=lambda b: ver_of(b["bom"]))
        else:
            chosen[prod] = max(bs, key=lambda b: ver_of(b["bom"]))
    return chosen


def main():
    report = {"checks": [], "samples": [], "summary": {}}

    blocks, excel_data_rows = read_excel()
    chosen = choose_block(blocks)
    parents = set(chosen.keys())
    print(f"[excel] 数据行={excel_data_rows} 块={len(blocks)} 父产品={len(parents)}")

    plang = read_plang()
    print(f"[plang] 在产 distinct dm = {len(plang)}")
    expected = sorted(set(plang) & parents)
    print(f"[expected] 244∩Excel父件 = {len(expected)}")

    dump = read_dump("HSDZ_MES")
    dump_test = read_dump("HSDZ_MES_TEST")
    db_prods = set(dump.keys())

    # --- 产品集合对账 ---
    missing = sorted(set(expected) - db_prods)       # 应导未导
    extra = sorted(db_prods - set(expected))         # 导了不该导
    report["checks"].append({"id": "B-set-覆盖", "pass": not missing and not extra,
                             "expected": len(expected), "db": len(db_prods),
                             "missing": missing, "extra": extra})
    # 测试库同集合?
    report["checks"].append({"id": "B-set-测试库同集合", "pass": set(dump_test.keys()) == db_prods,
                             "test_db_prods": len(dump_test)})
    # 8 个无 BOM 产品
    hit8 = sorted(p for p in NO_BOM_8 if p in db_prods or p in set(expected))
    report["checks"].append({"id": "B-set-8个无BOM不在表", "pass": not hit8, "hit": hit8})

    # --- 逐产品逐行对账 ---
    total_rows = 0
    row_diff = []
    qty_diff = []
    code_diff = []
    seq_diff = []
    bom_diff = []
    for prod, b in sorted(chosen.items()):
        if prod not in dump:
            continue
        dbrows = dump[prod]
        total_rows += len(dbrows)
        exp_codes = [x["子件编码"] for x in b["来源行"]]
        got_codes = [x["子件编码"] for x in dbrows]
        if len(exp_codes) != len(got_codes):
            row_diff.append({"产品编码": prod, "excel": len(exp_codes), "db": len(got_codes)})
        if exp_codes != got_codes:
            code_diff.append({"产品编码": prod, "excel": exp_codes, "db": got_codes})
        # 行序 1..n
        if [x["行序"] for x in dbrows] != list(range(1, len(dbrows) + 1)):
            seq_diff.append({"产品编码": prod, "seq": [x["行序"] for x in dbrows]})
        if dbrows[0]["单据编号"] != b["bom"]:
            bom_diff.append({"产品编码": prod, "excel_bom": b["bom"], "db_bom": dbrows[0]["单据编号"]})
        for e, g in zip(b["来源行"], dbrows):
            want = q4(e["用量分子"], e["用量分母"])
            got = Decimal(g["标准用量"])
            if want != got:
                qty_diff.append({"产品编码": prod, "行序": e["行序(块内)"], "子件编码": e["子件编码"],
                                 "excel_num": e["用量分子"], "excel_den": e["用量分母"],
                                 "want": str(want), "db": g["标准用量"]})
    n_pairs = sum(len(dump[p]) for p in chosen if p in dump)
    report["checks"] += [
        {"id": "B-行数合计", "pass": total_rows == 1085, "rows": total_rows},
        {"id": "B-子件数逐产品", "pass": not row_diff, "diffs": row_diff[:10], "n": len(row_diff)},
        {"id": "B-子件编码序列", "pass": not code_diff, "diffs": code_diff[:5], "n": len(code_diff)},
        {"id": "B-标准用量(全表逐行)", "pass": not qty_diff, "diffs": qty_diff[:10], "n": len(qty_diff),
         "compared_rows": n_pairs},
        {"id": "B-行序1..n", "pass": not seq_diff, "diffs": seq_diff[:5], "n": len(seq_diff)},
        {"id": "B-单据编号=Excel编码", "pass": not bom_diff, "diffs": bom_diff[:5], "n": len(bom_diff)},
    ]

    # --- 抽查:固定 5 + 随机 5(种子固定,可复现) ---
    rnd = random.Random(20261030)
    random_pick = rnd.sample(sorted(p for p in chosen if p in dump), 5)
    report["random_sample"] = random_pick
    for prod in SAMPLE_FIXED + random_pick:
        b = chosen[prod]
        dbrows = dump[prod]
        expect = [{"行序": e["行序(块内)"], "子件编码": e["子件编码"], "标准用量": str(q4(e["用量分子"], e["用量分母"]))}
                  for e in b["来源行"]]
        got = [{"行序": g["行序"], "子件编码": g["子件编码"], "标准用量": g["标准用量"],
                "用量分子": g["用量分子"], "用量分母": g["用量分母"], "计量单位": g["计量单位"],
                "工序": "组装"} for g in dbrows]
        ok = (len(expect) == len(got) and all(
            e["子件编码"] == g["子件编码"] and e["标准用量"] == g["标准用量"] and e["行序"] == g["行序"]
            for e, g in zip(expect, got)))
        report["samples"].append({
            "产品编码": prod, "pass": ok, "单据编号": dbrows[0]["单据编号"], "子件数": len(got),
            "excel": expect, "db": got,
        })

    # --- 多版本选择核对(Excel 内同产品多块) ---
    by_prod = {}
    for b in blocks:
        by_prod.setdefault(b["产品编码"], []).append(b)
    multi = {p: bs for p, bs in by_prod.items() if len(bs) > 1}
    multi_in_scope = {p: bs for p, bs in multi.items() if p in set(expected)}
    report["multi_version"] = {
        "excel_multi_products": {p: [b["bom"] + ("(默认)" if b["默认BOM"] == "是" else "")
                                    for b in bs] for p, bs in sorted(multi.items())},
        "in_scope": {p: {"excel_blocks": [b["bom"] + ("(默认)" if b["默认BOM"] == "是" else "") for b in bs],
                         "chosen": chosen[p]["bom"], "db": dump[p][0]["单据编号"]}
                    for p, bs in sorted(multi_in_scope.items()) if p in dump},
    }
    mv_ok = all(v["chosen"] == v["db"] for v in report["multi_version"]["in_scope"].values())
    report["checks"].append({"id": "B-多版本选择(默认>V最大)", "pass": mv_ok,
                             "in_scope_products": len(report["multi_version"]["in_scope"]),
                             "detail": report["multi_version"]["in_scope"]})

    report["summary"] = {
        "excel_data_rows": excel_data_rows,
        "excel_blocks": len(blocks),
        "excel_parents": len(parents),
        "plang_in_production": len(plang),
        "expected_products": len(expected),
        "db_products": len(db_prods),
        "db_rows": total_rows,
    }

    # 输出
    (HERE / "reconcile-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str),
                                                encoding="utf-8")
    lines = []
    lines.append(f"Excel 数据行={excel_data_rows} 块={len(blocks)} 父产品={len(parents)}")
    lines.append(f"plang 在产 distinct dm={len(plang)};244∩Excel父件={len(expected)}")
    lines.append(f"DB 行={total_rows} 产品={len(db_prods)}")
    for c in report["checks"]:
        lines.append(f"[{'PASS' if c['pass'] else 'FAIL'}] {c['id']}: " + json.dumps(
            {k: v for k, v in c.items() if k not in ('id', 'pass')}, ensure_ascii=False, default=str))
    lines.append("--- 抽查 ---")
    for s in report["samples"]:
        lines.append(f"[{'PASS' if s['pass'] else 'FAIL'}] {s['产品编码']} 单据={s['单据编号']} 子件数={s['子件数']}")
        for e, g in zip(s["excel"], s["db"]):
            lines.append(f"   行{e['行序']}: {e['子件编码']} excel={e['标准用量']} db={g['标准用量']} 分子={g['用量分子']} 分母={g['用量分母']} 单位={g['计量单位']}")
    lines.append("--- 多版本 ---")
    lines.append(json.dumps(report["multi_version"], ensure_ascii=False, default=str))
    (HERE / "reconcile-report.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
