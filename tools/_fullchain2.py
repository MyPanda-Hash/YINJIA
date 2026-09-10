# _fullchain2.py — 总流程图全链路验收测试 v2(修复:btn抛错/A段双行拆单/E段DB核验)
import json, hmac, hashlib, base64, time, urllib.request, urllib.error, sys, io, subprocess
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
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP{e.code}: {e.read().decode('utf-8', 'ignore')[:180]}")

def btn(panel, button, form):
    r = api("/api/px/callButton", {"panelCode": panel, "buttonName": button, "formData": form, "buttonParam": {}})
    d = r.get("data") if isinstance(r, dict) and isinstance(r.get("data"), dict) else {}
    if "http_error" in r: raise RuntimeError(str(r))
    return d

def step(name, fn):
    try:
        fn(); PASS.append(name); print(f"  ✓ {name}")
    except Exception as e:
        FAIL.append(name); print(f"  ✗ {name}\n      {e}")

def load(panel, no):
    f = api(f"/api/px/getFormDescriptor?panelCode={panel}&code={no}")["data"]
    return f["data"], f["detailData"]["items"]

state = {}
for _ in range(25):
    try: urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)
TODAY = time.strftime("%Y-%m-%d")

print("━━━ A. 采购支线:暂收→检验→拆行 ━━━")
def a1():
    d = btn("QC_RECV", "保存", {"单据日期": TODAY, "供应商": "全链路供应商", "经手人": "admin",
        "detail": {"items": [
            {"物料编码": "T382", "物料名称": "除重金属炭棒滤芯", "规格型号": "10寸", "单位": "件", "暂收数量": 200, "仓库": "材料仓"},
            {"物料编码": "CL001", "物料名称": "45#圆钢", "规格型号": "Φ60", "单位": "kg", "暂收数量": 50, "仓库": "材料仓"}]}})
    state["zs"] = d["编号"]
    _, items = load("QC_RECV", state["zs"])
    state["lot"], state["lot2"] = items[0]["批号"], items[1]["批号"]
    assert len(state["lot"]) == 11 and len(state["lot2"]) == 11 and state["lot"] != state["lot2"]
    btn("QC_RECV", "审核", {"编号": state["zs"]})
step("A1 暂收单(双行,自动批号×2)+审核", a1)

def a2():
    d = btn("QC_RECV", "生成检验单", {"编号": state["zs"]}); state["ij"] = d["编号"]
    head, items = load("QC_INSP", state["ij"])
    assert len(items) == 2
    items[0].update({"合格数量": 180, "不合格数量": 20, "处置方式": "入库"})
    items[1].update({"合格数量": 40, "不合格数量": 10, "处置方式": "退货"})
    head.update({"检验员": "检验员F", "检验日期": TODAY, "总结论": "让步接收", "单据编号": state["ij"]})
    btn("QC_INSP", "保存", {**head, "detail": {"items": items}})
    btn("QC_INSP", "审核", {"编号": state["ij"]})
step("A2 检验单(T382合格180入库/CL001合格40退货10)+审核", a2)

def a3():
    d = btn("QC_INSP", "生成采购入库单", {"编号": state["ij"]}); state["pi"] = d["编号"]
    head, items = load("PURCHASE_IN", state["pi"])
    assert len(items) == 1 and items[0]["存货编码"] == "T382" and items[0]["实收数量"] == 180 and items[0]["批号"] == state["lot"], json.dumps(items, ensure_ascii=False)[:180]
    head["仓库"] = "材料仓"; head["单据编号"] = state["pi"]
    for it in items: it["仓库"] = "材料仓"
    btn("PURCHASE_IN", "保存", {**head, "detail": {"items": items}})
    btn("PURCHASE_IN", "审核", {"编号": state["pi"]})
step("A3 拆行→采购入库单(仅T382×180,批号贯通)+审核记账", a3)

def a4():
    d = btn("QC_INSP", "生成暂收退回单", {"编号": state["ij"]}); state["th"] = d["编号"]
    _, items = load("QC_RETURN", state["th"])
    assert len(items) == 1 and items[0]["物料编码"] == "CL001" and items[0]["退货数量"] == 10, json.dumps(items, ensure_ascii=False)[:150]
step("A4 拆行→暂收退回单(仅CL001×10)", a4)

print("━━━ B. 计划层 ━━━")
def b1():
    d = btn("WO_ORDER", "保存", {"单据日期": TODAY, "销售订单号": "XSDD-20260908-0002", "客户": "零售客户",
        "产品编码": "M-001", "产品名称": "炭棒", "单位": "件", "订单数量": 1000, "成型计划数量": 334,
        "交期": "2026-09-30", "生产车间": "成型1号车间", "detail": {"items": [{}]}})
    state["wo"] = d["编号"]
    _, items = load("WO_ORDER", state["wo"])
    ops = [it["工序"] for it in items]
    assert ops == ["混料", "成型", "切炭", "组装", "装箱"], str(ops)
    btn("WO_ORDER", "审核", {"编号": state["wo"]})
step("B1 生产工单(M-001×1000,五工序预填)+审核", b1)

print("━━━ C. 生产过程 ━━━")
def c1():
    d = btn("WO_ORDER", "生成领料单", {"编号": state["wo"]}); state["cl"] = d["编号"]
    head, items = load("MATERIAL_OUT", state["cl"])
    assert items[0]["材料编码"] == "T382" and items[0]["数量"] == 50, json.dumps(items, ensure_ascii=False)[:150]
    for it in items: it.update({"批号": state["lot"], "仓库": "材料仓"})
    head["单据编号"] = state["cl"]
    btn("MATERIAL_OUT", "保存", {**head, "detail": {"items": items}})
    btn("MATERIAL_OUT", "审核", {"编号": state["cl"]})
step("C1 领料单(BOM展开T382×50,批号扫码)+审核出库", c1)

def report(op, qty):
    d = btn("WO_REPORT", "保存", {"单据日期": TODAY, "工单号": state["wo"], "工序": op, "报工数量": qty, "报工人": f"{op}工"})
    btn("WO_REPORT", "审核", {"编号": d["编号"]})
step("C2 报工 混料1000", lambda: report("混料", 1000))
step("C3 报工 成型334", lambda: report("成型", 334))
step("C4 报工 切炭1000", lambda: report("切炭", 1000))
step("C5 报工 组装950", lambda: report("组装", 950))
step("C6 报工 装箱900", lambda: report("装箱", 900))

def c7():
    d = btn("QC_OP", "保存", {"单据日期": TODAY, "工单号": state["wo"], "工序": "成型", "检验员": "质检员F",
        "检验日期": TODAY, "总结论": "让步接收",
        "detail": {"items": [{"检验项目": "炭棒长度", "标准要求": "99±1mm", "检验结果": "合格", "实测数值": 99.1},
                              {"检验项目": "外观", "标准要求": "无裂纹", "检验结果": "不合格"}]}})
    state["gj"] = d["编号"]
    btn("QC_OP", "审核", {"编号": state["gj"]})
step("C7 工序质检单(成型)+审核", c7)

print("━━━ D. 成品与出货 ━━━")
def d1():
    state["plot"] = "PL" + state["lot"][4:]
    d = btn("FINISH_IN", "保存", {"单据日期": TODAY, "仓库": "半成品仓", "经手人": "装箱工", "生产车间": "装箱车间",
        "detail": {"items": [{"产品编码": "M-001", "产品名称": "炭棒", "实收数量": 900, "计量单位": "件", "批号": state["plot"], "仓库": "半成品仓"}]}})
    state["fi"] = d["编号"]
    btn("FINISH_IN", "审核", {"编号": state["fi"]})
step("D1 成品入库(M-001×900)+审核记账", d1)

def d2():
    d = btn("QC_DISPOSAL", "保存", {"单据日期": TODAY, "来源单号": state["gj"], "物料编码": "M-001", "物料名称": "炭棒",
        "批号": state["plot"], "数量": 40, "原仓库": "半成品仓", "处置方式": "转不良品仓", "处置原因": "外观不合格", "经手人": "admin"})
    state["bl"] = d["编号"]
    btn("QC_DISPOSAL", "审核", {"编号": state["bl"]})
step("D2 不良品处置(×40→不良品仓)+审核移仓", d2)

def d3():
    d = btn("SALE_OUT", "保存", {"单据日期": TODAY, "客户": "零售客户", "仓库": "半成品仓", "经手人": "admin",
        "detail": {"items": [{"存货编码": "M-001", "存货名称": "炭棒", "数量": 800, "计量单位": "件", "批号": state["plot"], "仓库": "半成品仓"}]}})
    state["so"] = d["编号"]
    btn("SALE_OUT", "审核", {"编号": state["so"]})
step("D3 销售出库(×800)+审核记账", d3)

print("━━━ E. DB 联动核验 ━━━")
def run_verify():
    cp = r"C:\INCER\YINJIA-MES\.m2-repo\com\microsoft\sqlserver\mssql-jdbc\12.8.1.jre11\mssql-jdbc-12.8.1.jre11.jar"
    out = subprocess.run(["java", "-cp", cp, r"C:\INCER\YINJIA-MES\tools\_verify.java" if False else "tools/_verify.java",
                          state["wo"], state["lot"], state["plot"]], capture_output=True, text=True,
                         cwd=r"C:\INCER\YINJIA-MES").stdout
    print(out)
    return out
def e_all():
    out = run_verify()
    assert "WO_PROGRESS_OK" in out, "五工序进度未联动"
    assert "TRACE_MAT_OK" in out, "材料批追溯不全"
    assert "TRACE_PROD_OK" in out, "产品批追溯不全"
    assert "LEDGER_OK" in out, "台账数字不符"
step("E 全链联动核验(进度/追溯/台账)", e_all)

print()
print(f"═══════ 全链路验收: {len(PASS)} 通过 / {len(FAIL)} 失败 ═══════")
if FAIL: print("失败:", FAIL)
print("单据:", json.dumps({k: v for k, v in state.items() if k not in ("lot", "lot2")}, ensure_ascii=False))
print("材料批:", state.get("lot"), "/", state.get("lot2"), "| 产品批:", state.get("plot"))
