# _flowwalk.py — 总流程图链路走查(模拟真实人员操作,除研发管理外全流程)
# 角色: 采购员/质检员A/生管员/仓管员/混料工/成型工/切炭工/组装工/装箱工/品质主管/销售内勤
# 每步走真实 API(保存→审核→生单→记账),记录通过/失败与缺失依赖
import json, hmac, hashlib, base64, time, urllib.request, urllib.error, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = "http://127.0.0.1:8090"
SECRET = "CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90"
PASS, FAIL, NOTES = [], [], []

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
        return {"http_error": e.code, "message": e.read().decode("utf-8", "ignore")[:200]}

def btn(panel, button, form):
    r = api("/api/px/callButton", {"panelCode": panel, "buttonName": button, "formData": form, "buttonParam": {}})
    if "http_error" in r: raise RuntimeError(f"[{panel}/{button}] {r.get('message')}")
    return r.get("data") or {}

def step(role, name, fn):
    try:
        fn(); PASS.append(f"[{role}] {name}"); print(f"  ✓ [{role}] {name}")
    except Exception as e:
        FAIL.append(f"[{role}] {name}"); print(f"  ✗ [{role}] {name} :: {e}")

def note(msg):
    NOTES.append(msg); print(f"  ⚠ {msg}")

def load(panel, no):
    f = api(f"/api/px/getFormDescriptor?panelCode={panel}&code={no}")
    if "http_error" in f: raise RuntimeError(f"载入 {panel}/{no} 失败: {f.get('message')}")
    d = f["data"]
    return d["data"], (d.get("detailData") or {}).get("items") or []

def open_panel(code):
    r = api("/api/px/queryFormDataList", {"panelCode": code, "pageNo": 1, "pageSize": 5, "condition": {}})
    if "http_error" in r: raise RuntimeError(f"面板 {code} 打开失败: {r.get('message')}")

state = {}
for _ in range(25):
    try: urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)
TODAY = time.strftime("%Y-%m-%d")

print("━━━ 0. 面板可达性(全模块) ━━━")
ALL_PANELS = ["PU_REQ","PU_ORDER","QC_RECV","QC_INSP","QC_RETURN","PURCHASE_IN","MATERIAL_OUT","FINISH_IN","SALE_OUT",
              "STOCK_STATUS","WO_ORDER","WO_SCHEDULE","WO_KIT","WO_REPORT","WO_REPORT_LIST","DAY_REPORT","FEED_CONFIRM",
              "MIX_RECORD","GRAN_RECORD","WH_RECORD","PACK_CONFIRM","EQUIP_CHECK","MAINT_PLAN","SAMPLE_REQ",
              "QC_OP","QC_RECORD","QC_DISPOSAL","ROD_RETURN","LOT_TRACE","ERPLG","INV","BOM","WH"]
def _openall():
    bad = []
    for c in ALL_PANELS: 
        try: open_panel(c)
        except Exception as e: bad.append(f"{c}: {e}")
    if bad: raise RuntimeError("; ".join(bad))
step("系统", f"全部 {len(ALL_PANELS)} 个流程面板可打开", _openall)

print("━━━ A. 采购支线(采购员+质检员) ━━━")
def a1():
    d = btn("QC_RECV", "保存", {"单据日期": TODAY, "供应商": "链测供应商A", "经手人": "采购员甲",
        "detail": {"items": [
            {"物料编码": "T382", "物料名称": "除重金属炭棒滤芯", "规格型号": "10寸", "单位": "件", "暂收数量": 300, "仓库": "材料仓"},
            {"物料编码": "CL001", "物料名称": "45#圆钢", "规格型号": "Φ60", "单位": "kg", "暂收数量": 60, "仓库": "材料仓"}]}})
    state["zs"] = d["编号"]
    _, items = load("QC_RECV", state["zs"])
    state["lot"], state["lot2"] = items[0]["批号"], items[1]["批号"]
    btn("QC_RECV", "审核", {"编号": state["zs"]})
step("采购员", "暂收登记(自动批号)+审核", a1)
def a2():
    d = btn("QC_RECV", "生成检验单", {"编号": state["zs"]}); state["ij"] = d["编号"]
    head, items = load("QC_INSP", state["ij"])
    items[0].update({"合格数量": 280, "不合格数量": 20, "处置方式": "入库"})
    items[1].update({"合格数量": 50, "不合格数量": 10, "处置方式": "退货"})
    head.update({"检验员": "质检员A", "检验日期": TODAY, "总结论": "让步接收", "单据编号": state["ij"]})
    btn("QC_INSP", "保存", {**head, "detail": {"items": items}})
    btn("QC_INSP", "审核", {"编号": state["ij"]})
step("质检员A", "来料检验(拆行处置)+审核", a2)
def a3():
    d = btn("QC_INSP", "生成采购入库单", {"编号": state["ij"]}); state["pi"] = d["编号"]
    head, items = load("PURCHASE_IN", state["pi"])
    head["仓库"] = "材料仓"; head["单据编号"] = state["pi"]
    for it in items: it["仓库"] = "材料仓"
    btn("PURCHASE_IN", "保存", {**head, "detail": {"items": items}})
    btn("PURCHASE_IN", "审核", {"编号": state["pi"]})
step("仓管员", "采购入库(记账)+审核", a3)
def a4():
    d = btn("QC_INSP", "生成暂收退回单", {"编号": state["ij"]}); state["th"] = d["编号"]
step("仓管员", "暂收退回单生成(退货行)", a4)

print("━━━ B. 计划层(生管员) ━━━")
def b1():
    d = btn("WO_ORDER", "保存", {"单据日期": TODAY, "销售订单号": "XSDD-20260908-0011", "客户": "零售客户",
        "产品编码": "M-001", "产品名称": "炭棒", "单位": "件", "订单数量": 2000, "成型计划数量": 667,
        "交期": "2026-10-15", "生产车间": "成型1号车间", "detail": {"items": [{}]}})
    state["wo"] = d["编号"]
    btn("WO_ORDER", "审核", {"编号": state["wo"]})
step("生管员", "生产工单(五工序预填)+审核", b1)
def b2():
    open_panel("WO_SCHEDULE"); open_panel("WO_KIT")
step("生管员", "排单计划/齐套表查看", b2)

print("━━━ C. 生产执行(各工序工人+扫码语义) ━━━")
def c1():
    d = btn("WO_ORDER", "生成领料单", {"编号": state["wo"]}); state["cl"] = d["编号"]
    head, items = load("MATERIAL_OUT", state["cl"])
    for it in items: it.update({"批号": state["lot"], "仓库": "材料仓"})
    head["单据编号"] = state["cl"]
    btn("MATERIAL_OUT", "保存", {**head, "detail": {"items": items}})
    btn("MATERIAL_OUT", "审核", {"编号": state["cl"]})
step("混料工(扫码领料)", "领料单(BOM展开+批号)+审核出库", c1)
def report(op, qty, who):
    d = btn("WO_REPORT", "保存", {"单据日期": TODAY, "工单号": state["wo"], "工序": op, "报工数量": qty, "报工人": who})
    btn("WO_REPORT", "审核", {"编号": d["编号"]})
step("混料工", "报工 混料2000", lambda: report("混料", 2000, "混料工甲"))
step("成型工", "报工 成型667(1切3)", lambda: report("成型", 667, "成型工乙"))
def c_qc():
    d = btn("QC_OP", "保存", {"单据日期": TODAY, "工单号": state["wo"], "工序": "成型", "检验员": "质检员B",
        "检验日期": TODAY, "总结论": "让步接收",
        "detail": {"items": [{"检验项目": "炭棒长度", "标准要求": "99±1mm", "检验结果": "合格", "实测数值": 99.3, "品序号": "1#"},
                              {"检验项目": "外观", "标准要求": "无裂纹", "检验结果": "不合格", "品序号": "2#"}]}})
    state["gj"] = d["编号"]
    btn("QC_OP", "审核", {"编号": state["gj"]})
step("质检员B", "工序质检(首件语义)+审核", c_qc)
step("切炭工", "报工 切炭2000", lambda: report("切炭", 2000, "切炭工丙"))
step("组装工", "报工 组装1900", lambda: report("组装", 1900, "组装工丁"))
step("装箱工", "报工 装箱1880", lambda: report("装箱", 1880, "装箱工戊"))

print("━━━ D. 成品与出货 ━━━")
def d1():
    state["plot"] = "PL" + state["lot"][4:]
    d = btn("FINISH_IN", "保存", {"单据日期": TODAY, "仓库": "半成品仓", "经手人": "装箱工戊", "生产车间": "装箱车间",
        "加工单号": state["wo"],
        "detail": {"items": [{"产品编码": "M-001", "产品名称": "炭棒", "实收数量": 1880, "计量单位": "件", "批号": state["plot"], "仓库": "半成品仓"}]}})
    state["fi"] = d["编号"]
    btn("FINISH_IN", "审核", {"编号": state["fi"]})
step("仓管员", "成品入库(装箱数)+审核记账", d1)
def d2():
    d = btn("QC_DISPOSAL", "保存", {"单据日期": TODAY, "来源单号": state["gj"], "物料编码": "M-001", "物料名称": "炭棒",
        "批号": state["plot"], "数量": 30, "原仓库": "半成品仓", "处置方式": "转隔离仓", "处置原因": "外观不合格待判定", "经手人": "品质主管"})
    state["bl"] = d["编号"]
    btn("QC_DISPOSAL", "审核", {"编号": state["bl"]})
step("品质主管", "不良品处置(→隔离仓)+审核移仓", d2)
def d3():
    d = btn("SALE_OUT", "保存", {"单据日期": TODAY, "客户": "零售客户", "仓库": "半成品仓", "经手人": "销售内勤",
        "销售订单号": "XSDD-20260908-0011",
        "detail": {"items": [{"存货编码": "M-001", "存货名称": "炭棒", "数量": 1800, "计量单位": "件", "批号": state["plot"], "仓库": "半成品仓"}]}})
    state["so"] = d["编号"]
    btn("SALE_OUT", "审核", {"编号": state["so"]})
step("销售内勤", "销售出库(订单关联)+审核记账", d3)

print("━━━ E. 记录与辅助单据(各岗位日常) ━━━")
def e1():
    d = btn("DAY_REPORT", "保存", {"单据日期": TODAY, "车间": "成型车间", "出勤人数": 6, "填表人": "成型组长",
        "detail": {"items": [{"姓名": "成型工乙", "时间": "8:00-17:00", "产品编码": "M-001", "产品名称": "炭棒", "规格": "10寸", "单位": "支", "数量": 667, "灌料重每支": 0.25, "物料总用量": 167, "报废": 4}]}})
    btn("DAY_REPORT", "审核", {"编号": d["编号"]})
step("成型组长", "生产日报表(成型口径)", e1)
def e2():
    d = btn("QC_RECORD", "保存", {"单据日期": TODAY, "检验类型": "巡线抽检", "车间": "组装车间", "产品编号": "M-001",
        "检验员": "质检员B", "总结论": "合格", "抽样数量": 10,
        "detail": {"items": [{"检验项目": "炭棒外观/长度", "标准要求": "5pcs/小时", "检验结果": "合格", "实测数值": 99.1},
                              {"检验项目": "成品外观/长度", "标准要求": "10pcs/小时", "检验结果": "合格", "实测数值": 99.4}]}})
    btn("QC_RECORD", "审核", {"编号": d["编号"]})
step("质检员B", "检验记录(巡线抽检口径)", e2)
def e3():
    d = btn("SAMPLE_REQ", "保存", {"下单日期": TODAY, "客户名": "南京好水", "录入人": "销售内勤", "费用": "0",
        "detail": {"items": [{"样品种类": "炭棒样", "产品整体规格": "10寸通用", "数量": 5, "打样背景": "客户新品验证", "交期": "2026-09-20"}]}})
    btn("SAMPLE_REQ", "审核", {"编号": d["编号"]})
step("销售内勤", "样品申请单", e3)
def e4():
    d = btn("EQUIP_CHECK", "保存", {"年月": TODAY[:7], "车间": "成型车间", "设备名称": "1号热压机", "点检人": "设备员",
        "detail": {"items": [{"检查内容": "液压杆长度", "点检方法": "目视比对", "检查标准": "符合型号", "点检日期": TODAY[5:], "结果": "正常"},
                              {"检查内容": "冷却风扇", "点检方法": "开机试转", "检查标准": "运转正常", "点检日期": TODAY[5:], "结果": "异常", "解决措施": "已报修"}]}})
    btn("EQUIP_CHECK", "审核", {"编号": d["编号"]})
step("设备员", "设备点检记录", e4)

print("━━━ F. 追溯与联动核验 ━━━")
def f1():
    r = api("/api/px/queryFormDataList", {"panelCode": "LOT_TRACE", "pageNo": 1, "pageSize": 100, "condition": {}})
    rows = ((r.get("data") or {}).get("list")) or []
    ev1 = [x.get("事件") for x in rows if x.get("批号") == state["lot"]]
    ev2 = [x.get("事件") for x in rows if x.get("批号") == state["plot"]]
    print(f"    材料批事件: {ev1}")
    print(f"    产品批事件: {ev2}")
    for need in ("暂收", "来料检验", "采购入库", "领料出库"):
        if need not in ev1: raise RuntimeError(f"材料批缺事件 {need}")
    for need in ("成品入库", "销售出库"):
        if need not in ev2: raise RuntimeError(f"产品批缺事件 {need}")
    if not any(e and e.startswith("不良处置") for e in ev2): raise RuntimeError("产品批缺事件 不良处置")
step("品质主管", "批号追溯(材料批4事件/产品批3事件)", f1)

print()
print(f"═══════ 链路走查: {len(PASS)} 通过 / {len(FAIL)} 失败 ═══════")
for f in FAIL: print("  ✗", f)
print("单据:", json.dumps({k: v for k, v in state.items() if k not in ("lot", "lot2")}, ensure_ascii=False))

