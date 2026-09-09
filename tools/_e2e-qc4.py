# _e2e-qc4.py — 最终拆行生成验证(正确路径 detailData.items)
import json, hmac, hashlib, base64, time, urllib.request, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = "http://127.0.0.1:8090"
SECRET = "CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90"

def b64u(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
def mint(u):
    h = b64u(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    now = int(time.time())
    p = b64u(json.dumps({"sub": u, "iat": now, "exp": now + 7200}, separators=(",", ":")).encode())
    return h + "." + p + "." + b64u(hmac.new(SECRET.encode(), (h + "." + p).encode(), hashlib.sha256).digest())

TOKEN = mint("admin")
def api(path, body=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body else None,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + TOKEN},
        method="POST" if body is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read().decode())
    except urllib.error.HTTPError as e: return {"http_error": e.code, "body": e.read().decode()[:300]}

def btn(panel, button, form):
    r = api("/api/px/callButton", {"panelCode": panel, "buttonName": button, "formData": form, "buttonParam": {}})
    print(f"[{panel}/{button}] -> {json.dumps(r, ensure_ascii=False)[:170]}")
    return r

INSP = "IJ-2026-09-0003"
print("== 1. 载入并填检验结果(detailData.items) ==")
form = api("/api/px/getFormDescriptor?panelCode=QC_INSP&code=" + INSP)
d = form["data"]
head, items = d["data"], d["detailData"]["items"]
for i, it in enumerate(items):
    qty = it.get("送检数量") or 0
    if i == 0: it["合格数量"], it["不合格数量"], it["处置方式"] = qty - 10, 10, "入库"
    else: it["合格数量"], it["不合格数量"], it["处置方式"] = 0, qty, "退货"
head["检验员"], head["检验日期"], head["总结论"] = "admin", "2026-09-09", "让步接收"
saveForm = {**head, "detail": {"items": items}}
btn("QC_INSP", "保存", saveForm)
btn("QC_INSP", "审核", {"编号": INSP})

print("== 2. 生成采购入库单(非退货行) ==")
g1 = btn("QC_INSP", "生成采购入库单", {"编号": INSP})
pi = (g1.get("data") or {}).get("编号")
print("== 3. 生成暂收退回单(退货行) ==")
g2 = btn("QC_INSP", "生成暂收退回单", {"编号": INSP})
th = (g2.get("data") or {}).get("编号")

print("== 4. 核验 ==")
for panel, no, cols in (("PURCHASE_IN", pi, ("存货编码", "实收数量", "批号", "计量单位")), ("QC_RETURN", th, ("物料编码", "退货数量", "批号"))):
    if not no: print(panel, "未生成"); continue
    f = api("/api/px/getFormDescriptor?panelCode=" + panel + "&code=" + no)["data"]
    print(f"{panel} {no} 头:", json.dumps({k: v for k, v in f["data"].items() if v and k not in ("selectConfig",)}, ensure_ascii=False)[:220])
    for it in f["detailData"]["items"]:
        print("  行:", json.dumps({k: it.get(k) for k in cols}, ensure_ascii=False))
print("== ALL DONE ==")
