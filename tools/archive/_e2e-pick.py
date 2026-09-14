# _e2e-pick.py — 扫码领料闭环 E2E:审核工单→生成领料单(BOM展开)→无批号拒审守卫→补批号→审核出库→kucun核验
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
    print(f"[{tag or panel}/{button}] " + json.dumps(r, ensure_ascii=False)[:150])
    return d

def lot_of(code):
    import subprocess
    out = subprocess.run(["java", "-cp", "C:/INCER/YINJIA-MES/.m2-repo/com/microsoft/sqlserver/mssql-jdbc/12.8.1.jre11/mssql-jdbc-12.8.1.jre11.jar",
        "C:/INCER/YINJIA-MES/tools/_Qry.java"], capture_output=True, text=True).stdout
    return out

for _ in range(25):
    try: urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)

WO = "GD-2026-09-0003"
print("== 1. 审核工单 GD-0003 (M-001) ==")
btn("WO_ORDER", "审核", {"编号": WO})

print("== 2. 生成领料单(BOM 展开) ==")
g = btn("WO_ORDER", "生成领料单", {"编号": WO})
mo = g.get("编号")
print("领料单:", mo)

print("== 3. 无批号直接审核(应被拒) ==")
btn("MATERIAL_OUT", "审核", {"编号": mo}, "守卫")

print("== 4. 载入草稿,查 T382 真实批号并回填 ==")
f = api("/api/px/getFormDescriptor?panelCode=MATERIAL_OUT&code=" + mo)
d = f.get("data") or {}
head, items = d.get("data") or {}, (d.get("detailData") or {}).get("items") or []
for it in items:
    print("  领料行:", json.dumps({k: it.get(k) for k in ("材料编码", "材料名称", "数量")}, ensure_ascii=False))
# 批号由外部查询(见下一步 _Qry 输出),先占位:取 kucun T382 的批号
print("   (批号在下一步用 DB 查询结果填入,见脚本尾注)")
# 用已知批号: T382 库存批号需要查询——通过 v 查询接口拿不到,直接调 queryFormDataList STOCK_STATUS
q = api("/api/px/queryFormDataList", {"panelCode": "STOCK_STATUS", "pageNo": 1, "pageSize": 50, "condition": {}})
rows = ((q.get("data") or {}).get("rows")) or []
lot = None
for row in rows:
    if str(row.get("存货编码") or row.get("wzdm")) == "T382":
        lot = row.get("批号") or row.get("lot_no")
        print("  T382 台账批号:", lot, "| 现存量:", row.get("现存量(主)") or row.get("yl"))
        break
if lot:
    for it in items: it["批号"] = lot
    btn("MATERIAL_OUT", "保存", {**head, "单据编号": mo, "detail": {"items": items}})
    print("== 5. 补批号后审核出库 ==")
    btn("MATERIAL_OUT", "审核", {"编号": mo})
else:
    print("!! 未找到 T382 台账批号,跳过出库(检查 kucun)")
print("== DONE ==")
