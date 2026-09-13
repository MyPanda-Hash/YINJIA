# _e2e-qc.py — 品检分流链端到端验证(真实 API:保存→审核→生成检验单→审核→拆行生成入库/退回)
# 用法: python _e2e-qc.py   (需后端 8090 运行中)
import json, hmac, hashlib, base64, time, urllib.request, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = "http://127.0.0.1:8090"
SECRET = "CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90"  # application.yml 默认(未设环境变量)

def b64u(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
def mint(username):
    h = b64u(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    now = int(time.time())
    p = b64u(json.dumps({"sub": username, "iat": now, "exp": now + 7200}, separators=(",", ":")).encode())
    sig = b64u(hmac.new(SECRET.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest())
    return f"{h}.{p}.{sig}"

TOKEN = mint("admin")
def api(path, body=None, method=None):
    req = urllib.request.Request(BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + TOKEN},
        method=method or ("POST" if body is not None else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return {"http_error": e.code, "body": e.read().decode()[:300]}

def btn(panel, button, form):
    r = api("/api/px/callButton", {"panelCode": panel, "buttonName": button, "formData": form, "buttonParam": {}})
    print(f"[{panel}/{button}] -> {json.dumps(r, ensure_ascii=False)[:220]}")
    return r

print("== 0. token & 面板配置 ==")
cfg = api("/api/px/getPanelConfig?panelCode=QC_RECV")
ok = "http_error" not in cfg
print("config ok:", ok)
if not ok: print(cfg); sys.exit(1)

print("== 1. 送料暂收单:保存 ==")
recv = btn("QC_RECV", "保存", {
    "单据日期": "2026-09-09", "供应商": "测试供应商", "供应商编码": "CS001", "到货日期": "2026-09-09", "经手人": "admin",
    "detail": {"items": [
        {"物料编码": "CL001", "物料名称": "45#圆钢", "规格型号": "Φ60", "单位": "kg", "采购数量": 100, "暂收数量": 100, "批号": "20260909001", "仓库": "材料仓"},
        {"物料编码": "CL002", "物料名称": "6061铝锭", "规格型号": "A00", "单位": "kg", "采购数量": 50, "暂收数量": 50, "批号": "20260909002", "仓库": "材料仓"},
    ]}})
recv_no = (recv.get("data") or recv).get("编号") if isinstance(recv.get("data") or recv, dict) else None
if not recv_no:
    # ApiResult 包装:{code,data}?
    d = recv.get("data") if isinstance(recv, dict) else None
    recv_no = (d or {}).get("编号") if isinstance(d, dict) else None
print("暂收单号:", recv_no)
if not recv_no: sys.exit(2)

print("== 2. 暂收单:审核 ==")
btn("QC_RECV", "审核", {"编号": recv_no})

print("== 3. 暂收单:生成检验单 ==")
gen = btn("QC_RECV", "生成检验单", {"编号": recv_no})
gd = gen.get("data") if isinstance(gen, dict) and "data" in gen else gen
insp_no = (gd or {}).get("编号") if isinstance(gd, dict) else None
print("检验单号:", insp_no, "goto:", (gd or {}).get("gotoPanel") if isinstance(gd, dict) else None)
if not insp_no: sys.exit(3)

print("== 4. 检验单:载入草稿并填结果 ==")
form = api("/api/px/getFormDescriptor?panelCode=QC_INSP&code=" + insp_no)
fd = form.get("data") if isinstance(form, dict) and "data" in form else form
print("草稿头:", json.dumps({k: v for k, v in (fd or {}).items() if k != "detail"}, ensure_ascii=False)[:200])
items = ((fd or {}).get("detail") or {}).get("items") or []
print("草稿行数:", len(items), json.dumps(items, ensure_ascii=False)[:300])
for i, it in enumerate(items):
    qty = it.get("送检数量") or 0
    it["合格数量"] = qty - 10 if i == 0 else 0
    it["不合格数量"] = 10 if i == 0 else qty
    it["处置方式"] = "入库" if i == 0 else "退货"
fd["检验员"] = "admin"; fd["检验日期"] = "2026-09-09"; fd["总结论"] = "让步接收"
btn("QC_INSP", "保存", fd)

print("== 5. 检验单:审核 ==")
btn("QC_INSP", "审核", {"编号": insp_no})

print("== 6. 检验单:生成采购入库单(非退货行) ==")
g1 = btn("QC_INSP", "生成采购入库单", {"编号": insp_no})
g1d = g1.get("data") if isinstance(g1, dict) and "data" in g1 else g1
print("入库单号:", (g1d or {}).get("编号") if isinstance(g1d, dict) else None)

print("== 7. 检验单:生成暂收退回单(退货行) ==")
g2 = btn("QC_INSP", "生成暂收退回单", {"编号": insp_no})
g2d = g2.get("data") if isinstance(g2, dict) and "data" in g2 else g2
print("退回单号:", (g2d or {}).get("编号") if isinstance(g2d, dict) else None)
print("== E2E DONE ==")
