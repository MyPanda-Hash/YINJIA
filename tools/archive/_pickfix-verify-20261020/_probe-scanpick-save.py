"""一次性探针:按 ScanPick.vue 的建单口径,向本地 8090(测试账套 YJ_TEST)调 /px/callButton 保存材料出库单。
目的:验证「手机端扫码领料」的**保存建单**这一步到底能不能过(df26118c 的提交说明写明「保存建单未实测」)。
只写测试账套;结果打印原始 JSON。
"""
import json
import urllib.request
import datetime

BASE = "http://127.0.0.1:8090"


def post(path, body, token=None):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(BASE + path, data=data, method="POST")
    req.add_header("Content-Type", "application/json; charset=utf-8")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"http": e.code, "body": e.read().decode("utf-8", "replace")}


login = post("/api/auth/login", {"userName": "admin", "password": "123456", "factory": "YJ_TEST"})
print("login:", login.get("code"), login.get("message"))
token = (login.get("data") or {}).get("token")
if not token:
    raise SystemExit("登录失败:" + json.dumps(login, ensure_ascii=False)[:400])

# 取两行有货的批号级可用量(模拟「扫两个物料标签」)
res = post("/api/px/queryFormDataList", {"panelCode": "STOCK_PICK", "pageNo": 1, "pageSize": 50}, token)
rows = (res.get("data") or {}).get("list") or []
print("STOCK_PICK rows:", len(rows))
picked, seen = [], set()
for r in rows:
    code = str(r.get("存货编码") or "").strip()
    if not code or code in seen:
        continue
    if (r.get("现存量") or 0) < 2:
        continue
    seen.add(code)
    picked.append(r)
    if len(picked) == 2:
        break
if not picked:
    raise SystemExit("STOCK_PICK 没取到有货的行")

items = []
for i, r in enumerate(picked):
    items.append({
        "行号": str(i + 1),
        "材料编码": str(r.get("存货编码") or "").strip(),
        "材料名称": str(r.get("存货名称") or "").strip(),
        "计量单位": str(r.get("计量单位") or "").strip(),
        "批次号": str(r.get("批号") or "").strip(),
        "仓库": str(r.get("仓库") or r.get("仓库编码") or "").strip(),
        "数量": 1,
        "单价": 0,
        "金额": 0,
        "明细备注": "扫码领料",
    })

form = {
    "单据日期": datetime.date.today().isoformat(),
    "单据编号": "",
    "业务类型": "生产领料",
    "仓库": "",
    "单据状态": "草稿",
    "备注": "条码扫码领料",
    "detail": {"items": items},
}
print("formData:", json.dumps(form, ensure_ascii=False))

out = post("/api/px/callButton", {"panelCode": "MATERIAL_OUT", "buttonName": "保存", "formData": form}, token)
print("SAVE =>", json.dumps(out, ensure_ascii=False)[:1200])
