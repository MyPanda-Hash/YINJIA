# _e2e-dualout.py — 产品批号 + 切炭双出口 E2E
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
    except urllib.error.HTTPError as e: return {"http_error": e.code, "message": e.read().decode("utf-8", "ignore")[:220]}

def btn(panel, button, form):
    r = api("/api/px/callButton", {"panelCode": panel, "buttonName": button, "formData": form, "buttonParam": {}})
    if "http_error" in r: raise RuntimeError(f"[{panel}/{button}] {r['message']}")
    return r.get("data") or {}

for _ in range(25):
    try: urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)
TODAY = time.strftime("%Y-%m-%d")
WO = "GD-2026-09-0016"

print("== 1. 生成产品批号(两次调用应同号) ==")
d1 = btn("WO_ORDER", "生成产品批号", {"编号": WO})
d2 = btn("WO_ORDER", "生成产品批号", {"编号": WO})
print("  第一次:", d1.get("产品批号"), "| 第二次:", d2.get("产品批号"))
assert d1.get("产品批号") and d1.get("产品批号") == d2.get("产品批号"), "批号应一次生成终身复用"
print("  ✓ 同号复用")
print("  批号格式校验:", "✓" if len(d1["产品批号"]) == 11 else "✗")

print("== 2. 切炭报工 完成数量600/直销数量150 → 审核 ==")
d = btn("WO_REPORT", "保存", {"单据日期": TODAY, "工单号": WO, "工序": "切炭", "报工数量": 600, "直销数量": 150, "报工人": "切炭工己"})
bg = d.get("编号")
f = api(f"/api/px/getFormDescriptor?panelCode=WO_REPORT&code={bg}")["data"]["data"]
assert f.get("直销数量") == 150, f"直销数量未落库: {f.get('直销数量')}"
print("  ✓ 直销数量已落库(150)")
btn("WO_REPORT", "审核", {"编号": bg})
print("  报工单:", bg, "已审核")

print("== 3. 守卫:直销数量>报工数量 拒绝 ==")
try:
    d = btn("WO_REPORT", "保存", {"单据日期": TODAY, "工单号": WO, "工序": "切炭", "报工数量": 10, "直销数量": 20, "报工人": "测试"})
    btn("WO_REPORT", "审核", {"编号": d["编号"]})
    print("  ✗ 未拒绝!")
except RuntimeError as e:
    print("  ✓ 拒绝:", str(e)[:90])

print("== 4. 重审幂等(弃审→重审不重复生成入库) ==")
btn("WO_REPORT", "弃审", {"编号": bg})
btn("WO_REPORT", "审核", {"编号": bg})
print("  (弃审→重审完成)")

print("== DONE 核验用 _Qry ==")
print("WO:", WO, "| BG:", bg, "| 产品批号:", d1.get("产品批号"))
