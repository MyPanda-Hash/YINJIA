# _e2e-redreverse.py — 红字冲回 E2E:切炭报工(直销120)→审核→弃审→红字入库→台账归零→重审→新入库→再弃审→再归零
import json, hmac, hashlib, base64, time, urllib.request, urllib.error, sys, io, subprocess
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
    except urllib.error.HTTPError as e: return {"http_error": e.code, "message": e.read().decode("utf-8", "ignore")[:250]}

def btn(panel, button, form):
    r = api("/api/px/callButton", {"panelCode": panel, "buttonName": button, "formData": form, "buttonParam": {}})
    if "http_error" in r: raise RuntimeError(f"[{panel}/{button}] {r['message']}")
    return r.get("data") or {}

def check_db(lot):
    cp = r"C:\INCER\YINJIA-MES\.m2-repo\com\microsoft\sqlserver\mssql-jdbc\12.8.1.jre11\mssql-jdbc-12.8.1.jre11.jar"
    out = subprocess.run(["java", "-cp", cp, "C:/INCER/YINJIA-MES/tools/_Qry2.java", "X", lot],
                         capture_output=True, text=True, cwd=r"C:\INCER\YINJIA-MES").stdout
    return out

for _ in range(25):
    try: urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)
TODAY = time.strftime("%Y-%m-%d")
WO = "GD-2026-09-0016"

print("== 1. 切炭报工(完成800,直销120)→审核 ==")
d = btn("WO_REPORT", "保存", {"单据日期": TODAY, "工单号": WO, "工序": "切炭", "报工数量": 800, "直销数量": 120, "报工人": "切炭工红"})
bg = d["编号"]
btn("WO_REPORT", "审核", {"编号": bg})
print("  报工:", bg, "已审核")

print("== 2. 弃审 → 红字入库自动生成 ==")
btn("WO_REPORT", "弃审", {"编号": bg})
print("  报工已弃审")

# 核验: 产品批号台账 rkl 应 = 150(原) - 150(旧冲) + 120(新) - 120(红) = 0
# 旧轮次已有 FI-10(+150) + FI-10红(-150); 本轮 FI-新(+120) + FI-红(-120) → 净0
# 但上一轮弃审后重审了 BG-47(150) → 又有 +150... 复杂, 直接查当前数
print(check_db("20260910016"))

print("== 3. 重审(应再生成新入库) ==")
btn("WO_REPORT", "审核", {"编号": bg})
print("  已重审")
print(check_db("20260910016"))

print("== 4. 再弃审(再冲回) ==")
btn("WO_REPORT", "弃审", {"编号": bg})
print("  已再弃审")
print(check_db("20260910016"))

print("== DONE ==")
print("报工:", bg)
