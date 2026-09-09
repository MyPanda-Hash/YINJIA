# _e2e-wo.py — 工单模块端到端:保存工单(验证五工序预填)→审核→查进度行
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

for _ in range(25):
    try: urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)

print("== 1. 保存工单(不带工序行,应自动预填五道) ==")
r = api("/api/px/callButton", {"panelCode": "WO_ORDER", "buttonName": "保存", "buttonParam": {}, "formData": {
    "单据日期": "2026-09-09", "销售订单号": "XSDD-20260908-0011", "客户": "零售客户",
    "产品编码": "CP001", "产品名称": "铝棒 Φ80", "规格型号": "Φ80×3000", "单位": "件",
    "订单数量": 500, "成型计划数量": 167, "交期": "2026-09-20", "生产车间": "成型1号车间",
    "detail": {"items": [{"工序": None}]}}})
no = (r.get("data") or {}).get("编号")
print("工单号:", no, json.dumps(r, ensure_ascii=False)[:120])

print("== 2. 回读工序进度行 ==")
f = api("/api/px/getFormDescriptor?panelCode=WO_ORDER&code=" + no)
d = f.get("data") or {}
items = (d.get("detailData") or {}).get("items") or []
for it in items:
    print("  工序:", it.get("工序"), "| 计划:", it.get("计划数量"), "| 完成:", it.get("完成数量"))
print("工序行数:", len(items), "(期望 5)")

print("== 3. 审核 ==")
r2 = api("/api/px/callButton", {"panelCode": "WO_ORDER", "buttonName": "审核", "buttonParam": {}, "formData": {"编号": no}})
print(json.dumps(r2, ensure_ascii=False)[:130])
print("== DONE ==")
