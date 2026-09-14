# _e2e-lot.py — 验证批号自动取号:保存无批号的暂收单 → 批号应为 yyyymmddNNN
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
    except urllib.error.HTTPError as e: return {"http_error": e.code, "body": e.read().decode()[:200]}

# 等后端就绪
for _ in range(20):
    try:
        urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)

print("== 保存不带批号的暂收单 ==")
r = api("/api/px/callButton", {"panelCode": "QC_RECV", "buttonName": "保存", "buttonParam": {}, "formData": {
    "单据日期": "2026-09-09", "供应商": "批号测试", "经手人": "admin",
    "detail": {"items": [
        {"物料编码": "CL003", "物料名称": "6063铝棒", "规格型号": "Φ120", "单位": "kg", "暂收数量": 20, "仓库": "材料仓"},
        {"物料编码": "CL001", "物料名称": "45#圆钢", "规格型号": "Φ60", "单位": "kg", "暂收数量": 5, "仓库": "材料仓"},
    ]}}})
no = (r.get("data") or {}).get("编号")
print("单号:", no)

print("== 回读明细行批号 ==")
f = api("/api/px/getFormDescriptor?panelCode=QC_RECV&code=" + no)["data"]
for it in f["detailData"]["items"]:
    print("  行:", it.get("物料编码"), "| 批号:", it.get("批号"), "| 数量:", it.get("暂收数量"))
lots = [it.get("批号") for it in f["detailData"]["items"]]
import re
ok = all(lots) and all(re.fullmatch(r"\d{11}", l) for l in lots) and lots[0] != lots[1]
print("批号校验(yyyymmddNNN 且互不相同):", "PASS" if ok else "FAIL " + str(lots))
