# _e2e-saleout.py — 销售出库记账 E2E:出库单(T382/批INIT-T382/半成品仓/10)→审核→kucun 56→46
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
    d = r.get("data") if isinstance(r, dict) and isinstance(r.get("data"), dict) else {}
    print(f"[{panel}/{button}] " + json.dumps(r, ensure_ascii=False)[:140])
    return d

for _ in range(25):
    try: urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)

print("== 1. 销售出库单:保存(T382 ×10, 批 INIT-T382, 半成品仓) ==")
r = btn("SALE_OUT", "保存", {"单据日期": "2026-09-09", "客户": "零售客户", "仓库": "半成品仓", "经手人": "admin",
    "detail": {"items": [{"存货编码": "T382", "存货名称": "除重金属炭棒滤芯", "数量": 10, "计量单位": "件", "批号": "INIT-T382", "仓库": "半成品仓"}]}})
no = r.get("编号")
print("出库单:", no)
print("== 2. 审核(三键出库) ==")
btn("SALE_OUT", "审核", {"编号": no})
print("== DONE,kucun 核验用 _Qry ==")
