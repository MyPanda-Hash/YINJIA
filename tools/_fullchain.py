# _fullchain.py — 总流程图全链路验收测试
# 剧本: 暂收→检验→拆行(入库/退回)→工单→领料(BOM)→五工序报工→工序质检→成品入库→不良处置→销售出库→追溯核验
import json, hmac, hashlib, base64, time, urllib.request, urllib.error, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = "http://127.0.0.1:8090"
SECRET = "CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90"
PASS, FAIL = [], []

def b64u(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
now = int(time.time())
h = b64u(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
p = b64u(json.dumps({"sub": "admin", "iat": now, "exp": now + 7200}, separators=(",", ":")).encode())
T = h + "." + p + "." + b64u(hmac.new(SECRET.encode(), (h + "." + p).encode(), hashlib.sha256).digest())

def api(path, body=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body else None,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + T},
        method="POST" if body is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read().decode())
    except urllib.error.HTTPError as e: return {"http_error": e.code, "body": e.read().decode()[:220]}

def btn(panel, button, form):
    r = api("/api/px/callButton", {"panelCode": panel, "buttonName": button, "formData": form, "buttonParam": {}})
    d = r.get("data") if isinstance(r, dict) and isinstance(r.get("data"), dict) else {}
    return d, r

def step(name, fn):
    try:
        out = fn()
        if out is False: FAIL.append(name); print(f"  ✗ {name}")
        else: PASS.append(name); print(f"  ✓ {name}")
        return out
    except Exception as e:
        FAIL.append(name); print(f"  ✗ {name}: {e}"); return None

def load(panel, no):
    f = api(f"/api/px/getFormDescriptor?panelCode={panel}&code={no}")
    d = f.get("data") or {}
    return d.get("data") or {}, (d.get("detailData") or {}).get("items") or []

state = {}
for _ in range(25):
    try: urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)

TODAY = time.strftime("%Y-%m-%d")

print("━━━ A. 采购支线:暂收→检验→拆行 ━━━")
def a1():
    d, r = btn("QC_RECV", "保存", {"单据日期": TODAY, "供应商": "全链路测试供应商", "经手人": "admin",
        "detail": {"items": [{"物料编码": "T382", "物料名称": "除重金属炭棒滤芯", "规格型号": "10寸", "单位": "件", "暂收数量": 200, "仓库": "材料仓"}]}})
    state["zs"] = d.get("编号"); assert state["zs"], r
    f = api(f"/api/px/getFormDescriptor?panelCode=QC_RECV&code={state['zs']}")["data"]
    state["lot"] = f["detailData"]["items"][0]["批号"]
    assert state["lot"] and len(state["lot"]) == 11, f"批号异常:{state['lot']}"
    btn("QC_RECV", "审核", {"编号": state["zs"]}); return True
step("A1 暂收单+自动批号+审核", a1)

def a2():
    d, _ = btn("QC_RECV", "生成检验单", {"编号": state["zs"]}); state["ij"] = d.get("编号"); assert state["ij"]
    head, items = load("QC_INSP", state["ij"])
    items[0].update({"合格数量": 180, "不合格数量": 20, "处置方式": "入库"})
    head.update({"检验员": "检验员F", "检验日期": TODAY, "总结论": "让步接收", "单据编号": state["ij"]})
    btn("QC_INSP", "保存", {**head, "detail": {"items": items}})
    btn("QC_INSP", "审核", {"编号": state["ij"]}); return True
step("A2 检验单(合格180/不合格20)+审核", a2)

def a3():
    d, _ = btn("QC_INSP", "生成采购入库单", {"编号": state["ij"]}); state["pi"] = d.get("编号"); assert state["pi"]
    head, items = load("PURCHASE_IN", state["pi"])
    head["仓库"] = "材料仓"; head["单据编号"] = state["pi"]
    for it in items: it["仓库"] = "材料仓"
    btn("PURCHASE_IN", "保存", {**head, "detail": {"items": items}})
    btn("PURCHASE_IN", "审核", {"编号": state["pi"]})
    assert items and items[0].get("实收数量") == 180 and items[0].get("存货编码") == "T382" and items[0].get("批号") == state["lot"], json.dumps(items, ensure_ascii=False)[:200]
    return True
step("A3 生成采购入库单(实收=合格180,批号贯通)+审核记账", a3)

def a4():
    d, r = btn("QC_INSP", "生成暂收退回单", {"编号": state["ij"]}); state["th"] = d.get("编号"); assert state["th"], r
    _, items = load("QC_RETURN", state["th"])
    assert items and items[0].get("退货数量") == 20, json.dumps(items, ensure_ascii=False)[:150]
    return True
step("A4 生成暂收退回单(退货=不合格20)", a4)

print("━━━ B. 计划层:工单 ━━━")
def b1():
    d, _ = btn("WO_ORDER", "保存", {"单据日期": TODAY, "销售订单号": "XSDD-20260908-0002", "客户": "零售客户",
        "产品编码": "M-001", "产品名称": "炭棒", "单位": "件", "订单数量": 1000, "成型计划数量": 334,
        "交期": "2026-09-30", "生产车间": "成型1号车间", "detail": {"items": [{}]}})
    state["wo"] = d.get("编号"); assert state["wo"]
    _, items = load("WO_ORDER", state["wo"])
    ops = [it.get("工序") for it in items]
    assert ops == ["混料", "成型", "切炭", "组装", "装箱"], str(ops)
    btn("WO_ORDER", "审核", {"编号": state["wo"]}); return True
step("B1 生产工单(M-001×1000,五工序预填)+审核", b1)

print("━━━ C. 生产过程:领料+五工序报工 ━━━")
def c1():
    d, r = btn("WO_ORDER", "生成领料单", {"编号": state["wo"]}); state["cl"] = d.get("编号"); assert state["cl"], r
    head, items = load("MATERIAL_OUT", state["cl"])
    need = items[0].get("数量")
    assert items[0].get("材料编码") == "T382" and need == 50, f"BOM展开异常 {json.dumps(items, ensure_ascii=False)[:150]}"
    for it in items: it.update({"批号": state["lot"], "仓库": "材料仓"})
    head["单据编号"] = state["cl"]
    btn("MATERIAL_OUT", "保存", {**head, "detail": {"items": items}})
    btn("MATERIAL_OUT", "审核", {"编号": state["cl"]}); return True
step("C1 领料单(BOM展开T382×50,扫码批号)+审核出库", c1)

def report(op, qty):
    d, _ = btn("WO_REPORT", "保存", {"单据日期": TODAY, "工单号": state["wo"], "工序": op, "报工数量": qty, "报工人": f"{op}工"})
    no = d.get("编号"); assert no
    btn("WO_REPORT", "审核", {"编号": no}); return no

step("C2 报工 混料1000", lambda: (report("混料", 1000) and True))
step("C3 报工 成型334(1切3折算)", lambda: (report("成型", 334) and True))
step("C4 报工 切炭1000", lambda: (report("切炭", 1000) and True))
step("C5 报工 组装950", lambda: (report("组装", 950) and True))
step("C6 报工 装箱900", lambda: (report("装箱", 900) and True))

def c7():
    d, _ = btn("QC_OP", "保存", {"单据日期": TODAY, "工单号": state["wo"], "工序": "成型", "检验员": "质检员F",
        "检验日期": TODAY, "总结论": "让步接收",
        "detail": {"items": [
            {"检验项目": "炭棒长度", "标准要求": "99±1mm", "检验结果": "合格", "实测数值": 99.1},
            {"检验项目": "外观", "标准要求": "无裂纹", "检验结果": "不合格"}]}})
    state["gj"] = d.get("编号"); assert state["gj"]
    btn("QC_OP", "审核", {"编号": state["gj"]}); return True
step("C7 工序质检单(成型,1项不合格)+审核", c7)

print("━━━ D. 成品与出货 ━━━")
def d1():
    d, _ = btn("FINISH_IN", "保存", {"单据日期": TODAY, "仓库": "半成品仓", "经手人": "装箱工", "生产车间": "装箱车间",
        "detail": {"items": [{"产品编码": "M-001", "产品名称": "炭棒", "实收数量": 900, "计量单位": "件", "批号": "PL" + state["lot"][4:], "仓库": "半成品仓"}]}})
    state["fi"] = d.get("编号"); state["plot"] = "PL" + state["lot"][4:]
    assert state["fi"]
    btn("FINISH_IN", "审核", {"编号": state["fi"]}); return True
step("D1 成品入库(M-001×900)+审核记账", d1)

def d2():
    d, _ = btn("QC_DISPOSAL", "保存", {"单据日期": TODAY, "来源单号": state["gj"], "物料编码": "M-001", "物料名称": "炭棒",
        "批号": state["plot"], "数量": 40, "原仓库": "半成品仓", "处置方式": "转不良品仓", "处置原因": "外观不合格", "经手人": "admin"})
    state["bl"] = d.get("编号"); assert state["bl"]
    btn("QC_DISPOSAL", "审核", {"编号": state["bl"]}); return True
step("D2 不良品处置(×40→不良品仓)+审核移仓", d2)

def d3():
    d, _ = btn("SALE_OUT", "保存", {"单据日期": TODAY, "客户": "零售客户", "仓库": "半成品仓", "经手人": "admin",
        "detail": {"items": [{"存货编码": "M-001", "存货名称": "炭棒", "数量": 800, "计量单位": "件", "批号": state["plot"], "仓库": "半成品仓"}]}})
    state["so"] = d.get("编号"); assert state["so"]
    btn("SALE_OUT", "审核", {"编号": state["so"]}); return True
step("D3 销售出库(×800)+审核记账", d3)

print("━━━ E. 联动核验(排产视图/追溯) ━━━")
def e1():
    f = api("/api/px/queryFormDataList", {"panelCode": "WO_SCHEDULE", "pageNo": 1, "pageSize": 50, "condition": {}})
    rows = ((f.get("data") or {}).get("rows")) or []
    row = next((r for r in rows if r.get("工单号") == state["wo"]), None)
    assert row, "排产视图无该工单"
    got = {k: row.get(k) for k in ("混料完成", "成型完成", "切炭完成", "组装完成", "装箱完成", "未完成数量")}
    print("    排产联动:", json.dumps(got, ensure_ascii=False))
    assert got["混料完成"] == 1000 and got["成型完成"] == 334 and got["装箱完成"] == 900, str(got)
    return True
step("E1 排产视图五工序完成数联动", e1)

def e2():
    f = api("/api/px/queryFormDataList", {"panelCode": "LOT_TRACE", "pageNo": 1, "pageSize": 100, "condition": {}})
    rows = ((f.get("data") or {}).get("rows")) or []
    ev1 = [r.get("事件") for r in rows if r.get("批号") == state["lot"]]
    ev2 = [r.get("事件") for r in rows if r.get("批号") == state["plot"]]
    print(f"    材料批 {state['lot']} 事件: {ev1}")
    print(f"    产品批 {state['plot']} 事件: {ev2}")
    assert "暂收" in ev1 and "来料检验" in ev1 and "采购入库" in ev1 and "领料出库" in ev1, str(ev1)
    assert "成品入库" in ev2 and "销售出库" in ev2 and any(e and e.startswith("不良处置") for e in ev2), str(ev2)
    return True
step("E2 批号追溯:材料批4事件+产品批3事件", e2)

print()
print(f"═══════ 全链路测试结果: {len(PASS)} 通过 / {len(FAIL)} 失败 ═══════")
if FAIL: print("失败项:", FAIL)
print("单据:", json.dumps({k: v for k, v in state.items() if k != "lot"}, ensure_ascii=False))
print("材料批号:", state.get("lot"), "| 产品批号:", state.get("plot"))
