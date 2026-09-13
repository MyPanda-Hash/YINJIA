# _e2e-qc3.py — 定位 getFormDescriptor 明细结构 → 正确回填 → 拆行生成
import json, hmac, hashlib, base64, time, urllib.request, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
BASE = "http://127.0.0.1:8090"
SECRET = "CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90"

def b64u(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
def mint(u):
    h = b64u(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    now = int(time.time())
    p = b64u(json.dumps({"sub": u, "iat": now, "exp": now + 7200}, separators=(",", ":")).encode())
    return h + "." + p + "." + b64u(hmac.new(SECRET.encode(), (h + "." + p).encode(), hashlib.sha256).digest())

TOKEN = mint("admin")
def api(path, body=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body else None,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + TOKEN},
        method="POST" if body is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read().decode())
    except urllib.error.HTTPError as e: return {"http_error": e.code, "body": e.read().decode()[:300]}

def btn(panel, button, form):
    r = api("/api/px/callButton", {"panelCode": panel, "buttonName": button, "formData": form, "buttonParam": {}})
    print(f"[{panel}/{button}] -> {json.dumps(r, ensure_ascii=False)[:180]}")
    return r

def walk(o, path=""):
    if isinstance(o, dict):
        for k, v in o.items(): yield from walk(v, f"{path}.{k}")
    elif isinstance(o, list):
        if o and path.endswith("items"): print("FOUND items at:", path, "count:", len(o), json.dumps(o[0], ensure_ascii=False)[:200])
        for i, v in enumerate(o[:2]): yield from walk(v, f"{path}[{i}]")

print("== 1. 弃审+删除 IJ-0001(释放占用) ==")
btn("QC_INSP", "弃审", {"编号": "IJ-2026-09-0001"})
btn("QC_INSP", "删除", {"编号": "IJ-2026-09-0001"})

print("== 2. 从 ZS-0001 重新生成检验单 ==")
g = btn("QC_RECV", "生成检验单", {"编号": "ZS-2026-09-0001"})
insp = ((g.get("data") or {}).get("编号")) if isinstance(g.get("data"), dict) else None
print("新检验单:", insp)

print("== 3. dump getFormDescriptor 结构(找 items 真实路径) ==")
form = api("/api/px/getFormDescriptor?panelCode=QC_INSP&code=" + insp)
list(walk(form))
if not any(True for _ in [1]):
    pass
# 若 walk 没打印,打出顶层键结构
def keys(o, d=0):
    if d > 3 or not isinstance(o, dict): return
    for k, v in o.items():
        t = type(v).__name__ + (f"[{len(v)}]" if isinstance(v, (list, dict)) else "")
        print("  " * d + f"{k}: {t}")
        if isinstance(v, dict) and d < 3: keys(v, d + 1)
keys(form)
