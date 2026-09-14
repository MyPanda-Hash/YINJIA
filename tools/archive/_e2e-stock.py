# _e2e-stock.py — 库存记账端到端:全链生成入库单→审核→kucun入账→弃审→冲回
import json, hmac, hashlib, base64, time, urllib.request, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = "http://127.0.0.1:8090"
SECRET = "CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90"

def b64u(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
now = int(time.time())
h = b64u(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
p = b64u(json.dumps({"sub": "admin", "iat": now, "exp": now + 7200}, separators=(",", ":")).encode())
TOKEN = h + "." + p + "." + b64u(hmac.new(SECRET.encode(), (h + "." + p).encode(), hashlib.sha256).digest())

def api(path, body=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body else None,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + TOKEN},
        method="POST" if body is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read().decode())
    except urllib.error.HTTPError as e: return {"http_error": e.code, "body": e.read().decode()[:250]}

def btn(panel, button, form):
    r = api("/api/px/callButton", {"panelCode": panel, "buttonName": button, "formData": form, "buttonParam": {}})
    d = r.get("data") if isinstance(r, dict) else {}
    print(f"[{panel}/{button}] -> {json.dumps(r, ensure_ascii=False)[:160]}")
    return d if isinstance(d, dict) else {}

for _ in range(25):
    try:
        urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)

print("== 1. 暂收单(自动批号)→审核→生成检验单 ==")
r1 = btn("QC_RECV", "保存", {"单据日期": "2026-09-09", "供应商": "记账测试", "经手人": "admin",
    "detail": {"items": [{"物料编码": "CL004", "物料名称": "切削液", "规格型号": "20L/桶", "单位": "升", "暂收数量": 30, "仓库": "材料仓"}]}})
zs = r1.get("编号"); btn("QC_RECV", "审核", {"编号": zs})
r2 = btn("QC_RECV", "生成检验单", {"编号": zs})
ij = r2.get("编号")

print("== 2. 检验单:填结果→审核→生成入库单(现在应带存货编码) ==")
f = api("/api/px/getFormDescriptor?panelCode=QC_INSP&code=" + ij)["data"]
head, items = f["data"], f["detailData"]["items"]
items[0]["合格数量"] = items[0].get("送检数量") or 30
items[0]["不合格数量"] = 0
items[0]["处置方式"] = "入库"
head.update({"检验员": "admin", "检验日期": "2026-09-09", "总结论": "合格", "单据编号": ij})
btn("QC_INSP", "保存", {**head, "detail": {"items": items}})
btn("QC_INSP", "审核", {"编号": ij})
r3 = btn("QC_INSP", "生成采购入库单", {"编号": ij})
pi = r3.get("编号")
print("入库单:", pi)

print("== 3. 入库单:确认仓库头字段(记账用)→审核 ==")
pf = api("/api/px/getFormDescriptor?panelCode=PURCHASE_IN&code=" + pi)["data"]
phead, pitems = pf["data"], pf["detailData"]["items"]
print("  行:", json.dumps({k: pitems[0].get(k) for k in ("存货编码", "存货名称", "实收数量", "批号", "仓库")}, ensure_ascii=False))
phead["仓库"] = "材料仓"
btn("PURCHASE_IN", "保存", {**phead, "detail": {"items": pitems}})
ra = btn("PURCHASE_IN", "审核", {"编号": pi})
audited = ra.get("单据状态") == "已审核"

print("== 4. 审核结果 ==")
print("已审核:", audited, "| 台账核验与弃审冲回由后续步骤执行")
