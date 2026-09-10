# _e2e-aux.py — 四个辅助出入库面板台账 E2E(各建一张→审核→查kucun→弃审→查冲回)
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
    except urllib.error.HTTPError as e: return {"http_error": e.code, "message": e.read().decode("utf-8", "ignore")[:220]}

def btn(panel, button, form):
    r = api("/api/px/callButton", {"panelCode": panel, "buttonName": button, "formData": form, "buttonParam": {}})
    if "http_error" in r: raise RuntimeError(f"[{panel}/{button}] {r['message']}")
    return r.get("data") or {}

PASS_C, FAIL_C = 0, 0
def test(name, panel, form, direction):
    global PASS_C, FAIL_C
    try:
        d = btn(panel, "保存", form)
        no = d["编号"]
        btn(panel, "审核", {"编号": no})
        out1 = check(no)
        btn(panel, "弃审", {"编号": no})
        out2 = check(no)
        print(f"  OK {name} {no} | 审核后 yl={out1} | 弃审后 yl={out2}")
        PASS_C += 1
    except Exception as e:
        print(f"  FAIL {name} :: {e}")
        FAIL_C += 1

def check(no):
    cp = r"C:\INCER\YINJIA-MES\.m2-repo\com\microsoft\sqlserver\mssql-jdbc\12.8.1.jre11\mssql-jdbc-12.8.1.jre11.jar"
    # 用 _Qry2 简化:直接查最新 kucun 中的 yl
    out = subprocess.run(["java", "-cp", cp, "tools/_Qry3.java", no], capture_output=True, text=True, cwd=r"C:\INCER\YINJIA-MES")
    return out.stdout.strip()

for _ in range(25):
    try: urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)
TODAY = time.strftime("%Y-%m-%d")
LOT = "20260910001"  # 已有 T382 材料仓批号

print("━━━ 1. OTHER_IN 其他入库(inbound: +rkl +yl) ━━━")
test("其他入库", "OTHER_IN",
     {"单据日期": TODAY, "仓库": "材料仓",
      "detail": {"items": [{"存货编码": "T382", "存货名称": "除重金属炭棒滤芯", "数量": 10, "计量单位": "件", "批号": LOT, "仓库": "材料仓"}]}}, "+")

print("━━━ 2. OTHER_OUT 其他出库(outbound: +ckl -yl) ━━━")
test("其他出库", "OTHER_OUT",
     {"单据日期": TODAY, "仓库": "材料仓",
      "detail": {"items": [{"存货编码": "T382", "存货名称": "除重金属炭棒滤芯", "数量": 5, "计量单位": "件", "批号": LOT, "仓库": "材料仓"}]}}, "-")

print("━━━ 3. OUTSOURCE_IN 委外入库(inbound) ━━━")
test("委外入库", "OUTSOURCE_IN",
     {"单据日期": TODAY, "仓库": "材料仓",
      "detail": {"items": [{"产品编码": "T382", "产品名称": "除重金属炭棒滤芯", "实收数量": 8, "计量单位": "件", "批号": LOT, "仓库": "材料仓"}]}}, "+")

print("━━━ 4. OUTSOURCE_ISSUE 委外发料(outbound) ━━━")
test("委外发料", "OUTSOURCE_ISSUE",
     {"单据日期": TODAY, "仓库": "材料仓",
      "detail": {"items": [{"材料编码": "T382", "材料名称": "除重金属炭棒滤芯", "数量": 3, "计量单位": "件", "批号": LOT, "仓库": "材料仓"}]}}, "-")

print(f"\n═══ 辅助台账: {PASS_C} 通过 / {FAIL_C} 失败 ═══")
