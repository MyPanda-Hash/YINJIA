# _e2e-final.py — 第10轮双 E2E:①产成品入库记账 ②不良品移仓(隔离仓)
import json, hmac, hashlib, base64, time, urllib.request, urllib.error, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = "http://127.0.0.1:8090"
SECRET = "CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90"

def b64u(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
now = int(time.time())
h = b64u(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
p = b64u(json.dumps({"sub": "admin", "iat": now, "exp": now + 7200}, separators=(",", ":")).encode())
T = h + "." + p + "." + b64u(hmac.new(SECRET.encode(), (h + "." + p).encode(), hashlib.sha256).digest())

def btn(panel, button, form, tag=""):
    req = urllib.request.Request(BASE + "/api/px/callButton", data=json.dumps({"panelCode": panel, "buttonName": button, "formData": form, "buttonParam": {}}).encode(), headers={"Content-Type": "application/json", "Authorization": "Bearer " + T})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.loads(r.read().decode())
            print(f"[{tag or panel}/{button}] " + json.dumps(d, ensure_ascii=False)[:130])
            return d.get("data") or {}
    except urllib.error.HTTPError as e:
        print(f"[{tag or panel}/{button}] ERR " + e.read().decode()[:200])
        return {}

for _ in range(25):
    try: urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)

print("== ① 产成品入库: T382 ×20 批 INIT-T382 半成品仓 ==")
r = btn("FINISH_IN", "保存", {"单据日期": "2026-09-09", "仓库": "半成品仓", "经手人": "admin", "生产车间": "装箱车间",
    "detail": {"items": [{"产品编码": "T382", "产品名称": "除重金属炭棒滤芯", "实收数量": 20, "计量单位": "件", "批号": "INIT-T382", "仓库": "半成品仓"}]}})
btn("FINISH_IN", "审核", {"编号": r.get("编号")})

print("== ② 不良品处理: T382 ×5 半成品仓 → 转隔离仓 ==")
r2 = btn("QC_DISPOSAL", "保存", {"单据日期": "2026-09-09", "来源单号": "GJ-2026-09-0001", "物料编码": "T382", "物料名称": "除重金属炭棒滤芯",
    "批号": "INIT-T382", "数量": 5, "原仓库": "半成品仓", "处置方式": "转隔离仓", "处置原因": "外观强度不合格待判定", "经手人": "admin"})
btn("QC_DISPOSAL", "审核", {"编号": r2.get("编号")})
print("== DONE,核验 _Qry ==")
