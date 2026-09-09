# _e2e-qc2.py — 品检分流链补充验证:填检验结果→拆行生成入库/退回(修正响应嵌套)
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
    print(f"[{panel}/{button}] -> {json.dumps(r, ensure_ascii=False)[:200]}")
    return r

def unwrap(r):
    d = r.get("data") if isinstance(r, dict) else None
    if isinstance(d, dict) and "data" in d and isinstance(d.get("data"), dict): return d["data"]
    return d if isinstance(d, dict) else {}

INSP = "IJ-2026-09-0001"
print("== 1. 弃审检验单 ==")
btn("QC_INSP", "弃审", {"编号": INSP})

print("== 2. 删除旧入库草稿 PI-2026-09-0002(释放占用) ==")
btn("PURCHASE_IN", "删除", {"编号": "PI-2026-09-0002"})
print("== 2b. 删除误建空检验单 IJ-2026-09-0002 ==")
btn("QC_INSP", "删除", {"编号": "IJ-2026-09-0002"})

print("== 3. 载入检验单草稿(正确嵌套 data.data) ==")
form = api("/api/px/getFormDescriptor?panelCode=QC_INSP&code=" + INSP)
fd = unwrap(form)
items = (fd.get("detail") or {}).get("items") or []
print("行数:", len(items))
for i, it in enumerate(items):
    print("  行", i, json.dumps(it, ensure_ascii=False)[:150])
    qty = it.get("送检数量") or 0
    if i == 0: it["合格数量"], it["不合格数量"], it["处置方式"] = qty - 10, 10, "入库"
    else: it["合格数量"], it["不合格数量"], it["处置方式"] = 0, qty, "退货"
fd["检验员"] = "admin"; fd["检验日期"] = "2026-09-09"; fd["总结论"] = "让步接收"
fd["单据编号"] = INSP; fd["编号"] = INSP

print("== 4. 保存+审核 ==")
btn("QC_INSP", "保存", fd)
btn("QC_INSP", "审核", {"编号": INSP})

print("== 5. 生成采购入库单(期望只带处置=入库行,实收=合格数量) ==")
g1 = unwrap(btn("QC_INSP", "生成采购入库单", {"编号": INSP}))
pi_no = g1.get("编号")
print("入库单号:", pi_no)

print("== 6. 生成暂收退回单(期望只带处置=退货行,退货=不合格数量) ==")
g2 = unwrap(btn("QC_INSP", "生成暂收退回单", {"编号": INSP}))
th_no = g2.get("编号")
print("退回单号:", th_no)

print("== 7. 核验生成单据内容 ==")
if pi_no:
    pf = unwrap(api("/api/px/getFormDescriptor?panelCode=PURCHASE_IN&code=" + pi_no))
    print("入库单头:", json.dumps({k: v for k, v in pf.items() if k != "detail"}, ensure_ascii=False)[:260])
    for it in (pf.get("detail") or {}).get("items") or []:
        print("  入库行:", json.dumps({k: it.get(k) for k in ("存货编码", "实收数量", "批号", "计量单位")}, ensure_ascii=False))
if th_no:
    tf = unwrap(api("/api/px/getFormDescriptor?panelCode=QC_RETURN&code=" + th_no))
    print("退回单头:", json.dumps({k: v for k, v in tf.items() if k != "detail"}, ensure_ascii=False)[:200])
    for it in (tf.get("detail") or {}).get("items") or []:
        print("  退回行:", json.dumps({k: it.get(k) for k in ("物料编码", "退货数量", "批号")}, ensure_ascii=False))
print("== DONE ==")
