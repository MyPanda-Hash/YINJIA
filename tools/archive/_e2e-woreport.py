# _e2e-woreport.py — 报工闭环 E2E:报工单保存→审核(进度累计)→排产视图联动→弃审冲回→再审核
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

def btn(panel, button, form, tag=""):
    r = api("/api/px/callButton", {"panelCode": panel, "buttonName": button, "formData": form, "buttonParam": {}})
    d = r.get("data") if isinstance(r, dict) and isinstance(r.get("data"), dict) else {}
    print(f"[{tag or panel}/{button}] " + json.dumps(r, ensure_ascii=False)[:140])
    return d

for _ in range(25):
    try: urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)

WO = "GD-2026-09-0002"
print("== 1. 报工单:成型 300 ==")
r = btn("WO_REPORT", "保存", {"单据日期": "2026-09-09", "工单号": WO, "工序": "成型", "报工数量": 300, "报工人": "张三"})
bg = r.get("编号")
print("报工单号:", bg)
print("== 2. 审核(应累计 成型完成 300) ==")
btn("WO_REPORT", "审核", {"编号": bg})
print("== 3. 再报一张:混料 500 ==")
r2 = btn("WO_REPORT", "保存", {"单据日期": "2026-09-09", "工单号": WO, "工序": "混料", "报工数量": 500, "报工人": "李四"})
bg2 = r2.get("编号")
btn("WO_REPORT", "审核", {"编号": bg2})
print("== 4. 排产视图联动 ==")
f = api("/api/px/queryFormDataList", {"panelCode": "WO_SCHEDULE", "pageNo": 1, "pageSize": 10, "condition": {"工单号": WO}})
rows = ((f.get("data") or {}).get("rows")) or []
for row in rows:
    print("  ", json.dumps({k: row.get(k) for k in ("工单号", "混料完成", "成型完成", "切炭完成", "未完成数量")}, ensure_ascii=False))
print("== 5. 弃审第二张(混料应冲回 0) + 守卫测试:未审核工单报工 ==")
btn("WO_REPORT", "弃审", {"编号": bg2})
f = api("/api/px/queryFormDataList", {"panelCode": "WO_SCHEDULE", "pageNo": 1, "pageSize": 10, "condition": {"工单号": WO}})
rows = ((f.get("data") or {}).get("rows")) or []
for row in rows:
    print("  弃审后:", json.dumps({k: row.get(k) for k in ("混料完成", "成型完成")}, ensure_ascii=False))
r3 = btn("WO_REPORT", "保存", {"单据日期": "2026-09-09", "工单号": "GD-2026-09-0003", "工序": "成型", "报工数量": 10, "报工人": "守卫"})
if r3.get("编号"):
    rr = btn("WO_REPORT", "审核", {"编号": r3.get("编号")}, "守卫测试")
    if "http_error" in rr or not rr:
        print("  ✓ 未审核工单报工被拒(GD-0003 为草稿)")
print("== DONE ==")
