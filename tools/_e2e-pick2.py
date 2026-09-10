# _e2e-pick2.py — 补批号/仓库 → 审核出库 → 核验 kucun
import json, hmac, hashlib, base64, time, urllib.request, urllib.error, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = "http://127.0.0.1:8090"
SECRET = "CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90"

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
    except urllib.error.HTTPError as e: return {"http_error": e.code, "body": e.read().decode()[:250]}

def btn(panel, button, form):
    r = api("/api/px/callButton", {"panelCode": panel, "buttonName": button, "formData": form, "buttonParam": {}})
    print(f"[{panel}/{button}] " + json.dumps(r, ensure_ascii=False)[:150])
    return r.get("data") if isinstance(r.get("data"), dict) else {}

MO = "CL-2026-09-0001"
for _ in range(10):
    try: urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)

f = api("/api/px/getFormDescriptor?panelCode=MATERIAL_OUT&code=" + MO)["data"]
head, items = f["data"], f["detailData"]["items"]
for it in items:
    it["批号"] = "INIT-T382"
    it["仓库"] = "半成品仓"
print("回填后行:", json.dumps({k: items[0].get(k) for k in ("材料编码", "批号", "仓库", "数量")}, ensure_ascii=False))
btn("MATERIAL_OUT", "保存", {**head, "单据编号": MO, "detail": {"items": items}})
btn("MATERIAL_OUT", "审核", {"编号": MO})
print("== DONE,核验见 _Qry ==")
