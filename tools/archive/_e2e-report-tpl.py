# _e2e-report-tpl.py — 报表模板自选导出 + 模板管理 E2E(ADR-0002)
import json, hmac, hashlib, base64, time, urllib.request, urllib.error, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = "http://127.0.0.1:8090"
SECRET = "CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90"

def b64u(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
now = int(time.time())
h = b64u(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
p = b64u(json.dumps({"sub": "admin", "iat": now, "exp": now + 7200}, separators=(",", ":")).encode())
T = h + "." + p + "." + b64u(hmac.new(SECRET.encode(), (h + "." + p).encode(), hashlib.sha256).digest())

def api_raw(path):
    req = urllib.request.Request(BASE + path, headers={"Authorization": "Bearer " + T})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return r.read(), r.status
    except urllib.error.HTTPError as e: return e.read(), e.code

def api(method, path, body=None, params=""):
    req = urllib.request.Request(BASE + path + params, data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + T},
        method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode("utf-8", "ignore")
            return {"status": r.status, "body": json.loads(raw) if raw.strip().startswith("{") else raw}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "ignore")
        try: return {"status": e.code, "body": json.loads(raw)}
        except Exception: return {"status": e.code, "body": raw}

PASS, FAIL = [], []
def step(name, fn):
    try:
        out = fn(); PASS.append(name); print(f"  ✓ {name}" + (f" :: {out}" if out else ""))
    except Exception as e:
        FAIL.append(name); print(f"  ✗ {name} :: {e}")

for _ in range(25):
    try: urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)

# 读 classpath 同源模板作上传素材(so_order.jrxml 本地文件)
JRXML = open(r"C:\INCER\YINJIA-MES\backend\src\main\resources\reports\so_order.jrxml", encoding="utf-8").read()

print("━━━ A. 启动播种:so_order 已入库且面板可用 ━━━")
def a():
    r = api("GET", "/api/report/templates", params="?panelCode=SO_ORDER")
    assert r["status"] == 200, r
    lst = r["body"]["data"]
    codes = [t["code"] for t in lst]
    assert "so_order" in codes, f"so_order 未播种: {codes}"
    assert lst[0].get("enabled") is True
    return f"模板列表: {codes}"
step("so_order 启动播种 + 面板模板列表可见", a)

print("━━━ B. 上传第二张模板(同版式换编码,验证自选) ━━━")
TID = None
def b():
    global TID
    r = api("POST", "/api/report/templates", body={"templateCode": "so_order_v2", "panelCode": "SO_ORDER",
                                                   "name": "销售订单(简版)", "jrxml": JRXML, "remark": "E2E 测试模板"})
    assert r["status"] == 200, r
    r2 = api("GET", "/api/report/templates", params="?panelCode=SO_ORDER")
    lst = r2["body"]["data"]
    codes = [t["code"] for t in lst]
    assert "so_order_v2" in codes and "so_order" in codes, f"上传后列表异常: {codes}"
    allr = api("GET", "/api/report/templates", params="?all=true")
    tid = [t for t in allr["body"]["data"] if t["code"] == "so_order_v2"][0]["id"]
    TID = tid
    return f"现在可选模板: {codes}"
step("上传 so_order_v2(编译校验通过)→ 面板下拉两种可选", b)

print("━━━ C. 按选中模板导出 ━━━")
def c():
    # 找最近一张销售订单
    r = api("POST", "/api/px/queryFormDataList", body={"panelCode": "SO_ORDER", "pageNo": 1, "pageSize": 1, "condition": {}})
    rows = ((r.get("body") or {}).get("data") or {}).get("list") or []
    assert rows, "库中无销售订单可导出"
    no = rows[0].get("单据编号")
    out1, s1 = api_raw(f"/api/report/export?code=so_order&panelCode=SO_ORDER&docNo={no}&format=pdf")
    assert s1 == 200 and out1[:4] == b"%PDF", f"so_order PDF 异常: {s1} {out1[:40]}"
    out2, s2 = api_raw(f"/api/report/export?code=so_order_v2&panelCode=SO_ORDER&docNo={no}&format=pdf")
    assert s2 == 200 and out2[:4] == b"%PDF", f"so_order_v2 PDF 异常: {s2}"
    out3, s3 = api_raw(f"/api/report/export?code=so_order_v2&panelCode=SO_ORDER&docNo={no}&format=xlsx")
    assert s3 == 200 and out3[:2] == b"PK", f"xlsx 异常: {s3}"
    return f"单据 {no}: so_order={len(out1)}B, so_order_v2={len(out2)}B, xlsx={len(out3)}B"
step("两种模板各自导出 PDF + XLSX 均成功", c)

print("━━━ D. 停用 → 下拉不可见 / 导出被拒 ━━━")
def d():
    r = api("PUT", f"/api/report/templates/{TID}/enabled", params="?enabled=N")
    assert r["status"] == 200, r
    r2 = api("GET", "/api/report/templates", params="?panelCode=SO_ORDER")
    codes = [t["code"] for t in r2["body"]["data"]]
    assert "so_order_v2" not in codes, f"停用后仍可见: {codes}"
    r3 = api("GET", "/api/report/templates", params="?all=true")
    codes_all = [t["code"] for t in r3["body"]["data"]]
    assert "so_order_v2" in codes_all, "管理视角应仍可见"
    return f"启用列表: {codes}(停用项仅管理视角可见)"
step("停用 so_order_v2 → 面板隐藏,管理视角保留", d)

print("━━━ E. 坏模板上传被编译校验拒绝 ━━━")
def e():
    bad = JRXML.replace("</jasperReport>", "</jasperReportX>")
    r = api("POST", "/api/report/templates", body={"templateCode": "bad_tpl", "panelCode": "SO_ORDER",
                                                   "name": "坏模板", "jrxml": bad, "remark": ""})
    assert r["status"] == 400, f"坏模板应 400: {r['status']}"
    msg = str(r["body"])
    assert "编译失败" in msg or "模板" in msg, f"拒绝信息异常: {msg[:120]}"
    return "400 " + msg[msg.find("message") : msg.find("message") + 80] if "message" in msg else "400 已拒绝"
step("编译不过的 jrxml 上传 → 400 拒绝", e)

print("━━━ F. 清理测试模板 ━━━")
def f():
    r = api("DELETE", f"/api/report/templates/{TID}")
    assert r["status"] == 200, r
    r2 = api("GET", "/api/report/templates", params="?all=true")
    codes = [t["code"] for t in r2["body"]["data"]]
    assert "so_order_v2" not in codes, f"删除后仍存在: {codes}"
    return "so_order_v2 已删除,so_order 保留"
step("删除测试模板(so_order 不受影响)", f)

print()
print(f"═══════ 报表模板机制: {len(PASS)} 通过 / {len(FAIL)} 失败 ═══════")
for x in FAIL: print("  ✗", x)
