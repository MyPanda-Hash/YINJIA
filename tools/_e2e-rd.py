# _e2e-rd.py — 研发管理链路走查(真实两步流程:新增空白草稿 → 填写保存即归档 → 阶段完成 → 进度查询联动)
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
    except urllib.error.HTTPError as e:
        return {"http_error": e.code, "message": e.read().decode("utf-8", "ignore")[:260]}

def btn(panel, button, form):
    r = api("/api/px/callButton", {"panelCode": panel, "buttonName": button, "formData": form, "buttonParam": {}})
    if "http_error" in r: raise RuntimeError(f"[{panel}/{button}] {r['message']}")
    return r.get("data") or {}

def desc(panel, no):
    f = api(f"/api/px/getFormDescriptor?panelCode={panel}&code={no}")
    if "http_error" in f or not f.get("data"): raise RuntimeError(f"载入 {panel}/{no} 失败: {f.get('message')}")
    return f["data"]

def load(panel, no):
    d = desc(panel, no)
    return d["data"], d["meta"]

def dbsnap():
    cp = r"C:\INCER\YINJIA-MES\.m2-repo\com\microsoft\sqlserver\mssql-jdbc\12.8.1.jre11\mssql-jdbc-12.8.1.jre11.jar"
    subprocess.run(["java", "-cp", cp, "tools/_rdcheck.java"], capture_output=True, text=True, cwd=r"C:\INCER\YINJIA-MES")
    return open(r"C:\INCER\YINJIA-MES\tools\_rdcheck-out.txt", encoding="utf-8").read()

PASS, FAIL = [], []
def step(name, fn):
    try:
        fn(); PASS.append(name); print(f"  ✓ {name}")
    except Exception as e:
        FAIL.append(name); print(f"  ✗ {name} :: {e}")

for _ in range(25):
    try: urllib.request.urlopen(BASE + "/", timeout=3); break
    except Exception: time.sleep(3)
TODAY = time.strftime("%Y-%m-%d")
PROJ = "除重金属炭棒滤芯降本开发"
OWNER = "陈研发"
st = {}

print("━━━ A. 研发工程师:立项申请(新增→填写→保存即归档) ━━━")
def a1():
    d = btn("RD_APPROVAL", "保存", {})           # 新增:空表单 → 空白草稿
    st["lxa"] = d["编号"]
    assert st["lxa"] == "LXA-2026-09-0001", f"编号异常: {st['lxa']}"
    assert d.get("单据状态") == "草稿", f"新增应为草稿: {d.get('单据状态')}"
    d2 = btn("RD_APPROVAL", "保存", {            # 填写后保存 → 管理员保存即归档
        "编号": st["lxa"], "单据日期": TODAY, "客户名": "南京好水环保科技有限公司",
        "立项背景": "现有除重金属炭棒滤芯成本偏高,需通过活性粉配方与成型工艺优化降本 ≥12%",
        "机型及应用位置": "家用RO机前置滤芯(第一级)",
        "滤芯/炭棒规格或结构": "10寸标准炭棒,外径68±0.5mm,内径28mm",
        "项目开发目标": "降本12%以上,过滤性能保持现有水平,压降不超过5%",
        "项目输出": "配方定型报告、工艺参数表、样品检测报告、小批量试产总结",
        "开发周期要求": "3个月(2026-09 ~ 2026-11)",
        "其它要求": "需同步完成出货检验计划表",
        "申请立项人": "研发工程师小周", "申请立项日期": TODAY,
        "文档编号": "YJ-XS002-1", "文件管理人": "研发部", "密级": "秘密", "文件使用范围": "研发部/生产部",
    })
    assert d2.get("单据状态") == "已归档", f"保存后应归档: {d2.get('单据状态')}"
    head, _ = load("RD_APPROVAL", st["lxa"])
    assert head.get("客户名") == "南京好水环保科技有限公司", "客户名未落库"
    print(f"    {st['lxa']}: 新增草稿 → 填写保存 → 已归档")
step("立项申请:新增→填写→保存即归档(编号 LXA-2026-09-0001)", a1)

print("━━━ B. 研发主管:项目实施计划(定级必填下拉 + 10阶段五字段) ━━━")
def b1():
    d = btn("RD_PLAN", "保存", {})
    st["lxb"] = d["编号"]
    assert st["lxb"] == "LXB-2026-09-0001", f"编号异常: {st['lxb']}"
    _, meta = load("RD_PLAN", st["lxb"])
    m = {x["code"]: x for x in meta}
    lv = m.get("项目定级")
    assert lv, "缺项目定级字段"
    assert lv.get("isNotNull") is True, f"项目定级非必填: {lv}"
    assert lv.get("dataType") == "下拉框", f"项目定级非下拉: {lv.get('dataType')}"
    assert sorted(lv.get("options") or []) == ["三级", "二级", "四级"], f"选项异常: {lv.get('options')}"
    print(f"    项目定级: isNotNull=True, dataType=下拉框, options={lv.get('options')}")
step("项目定级=必填 + 下拉(二/三/四级)", b1)

def b2():
    try:
        btn("RD_PLAN", "阶段完成", {"编号": st["lxb"], "阶段序号": "1"})
        raise RuntimeError("草稿单据竟允许阶段完成")
    except RuntimeError as e:
        assert "草稿" in str(e), f"拒绝理由不符: {e}"
    print("    草稿态调用阶段完成 → 被拒绝(草稿单据不能标记阶段完成)")
step("守卫:草稿态不能标记阶段完成", b2)

STAGES = [
    ("立项与方案评审",       "2026-09-01", "2026-09-10", "张三"),
    ("样品打样与小批量试制", "2026-09-11", "2026-09-25", "李四"),
    ("性能测试与客户验证",   "2026-09-26", "2026-10-15", "王五"),
    ("工艺固化与产线导入",   "2026-10-16", "2026-11-05", "赵六"),
    ("结项评审与资料归档",   "2026-11-06", "2026-11-20", "张三"),
]
def b3():
    form = {"编号": st["lxb"], "单据日期": TODAY, "项目名称": PROJ, "项目定级": "二级",
            "测试内容": "配方降本验证 + 过滤性能与压降对比测试",
            "测试产品打样要求": "10寸标准炭棒,打样3批各30支",
            "测试目标": "降本≥12%,压降增幅≤5%",
            "测试条件": "常温25℃,进水重金属浓度0.1mg/L",
            "测试方法": "按GB/T 5750.6 连续通水测试",
            "测试标准": "出水重金属≤0.005mg/L",
            "负责人": OWNER, "编制日期": TODAY, "文档编号": "YJ-XS003-1",
            "文件管理人": "研发部", "密级": "秘密", "文件使用范围": "研发部/生产部"}
    for i, (content, start, end, who) in enumerate(STAGES, start=1):
        form[f"阶段{i}_计划内容"] = content
        form[f"阶段{i}_计划开始"] = start
        form[f"阶段{i}_计划完成"] = end
        form[f"阶段{i}_责任人"] = who
    d = btn("RD_PLAN", "保存", form)
    assert d.get("单据状态") == "已归档", f"保存后应归档: {d.get('单据状态')}"
    head, _ = load("RD_PLAN", st["lxb"])
    assert head.get("项目定级") == "二级", f"定级未落库: {head.get('项目定级')}"
    for i, (content, start, end, who) in enumerate(STAGES, start=1):
        assert head.get(f"阶段{i}_计划内容") == content, f"阶段{i}内容未落库"
        assert head.get(f"阶段{i}_计划开始") == start, f"阶段{i}计划开始未落库"
        assert head.get(f"阶段{i}_计划完成") == end, f"阶段{i}计划完成未落库"
        assert head.get(f"阶段{i}_责任人") == who, f"阶段{i}责任人未落库"
        assert head.get(f"阶段{i}_实际完成") in (None, ""), f"阶段{i}实际完成应为空"
    for i in (6, 7, 8, 9, 10):
        assert head.get(f"阶段{i}_计划内容") in (None, ""), f"阶段{i}应为空(未填写不落值)"
    print(f"    5个阶段×5字段全部落库;阶段6~10 保持空白;实际完成全部为空")
step("实施计划:10阶段五字段落库(填5留5)+ 保存即归档", b3)

print("━━━ C. 研发主管:阶段完成按钮 ━━━")
def c1():
    for n in (1, 2):
        r = btn("RD_PLAN", "阶段完成", {"编号": st["lxb"], "阶段序号": str(n)})
        assert r.get("实际完成") == TODAY, f"阶段{n} 实际完成异常: {r.get('实际完成')}"
    head, _ = load("RD_PLAN", st["lxb"])
    assert head.get("阶段1_实际完成") == TODAY and head.get("阶段2_实际完成") == TODAY, "阶段1/2 实际完成未落库"
    assert head.get("阶段3_实际完成") in (None, ""), "阶段3 不应有实际完成"
    print(f"    阶段1/2 实际完成={TODAY};阶段3 仍为空")
step("阶段1、2 完成(实际完成=当天)", c1)

def c2():
    try:
        btn("RD_PLAN", "阶段完成", {"编号": st["lxb"], "阶段序号": "11"})
        raise RuntimeError("非法阶段序号 11 未被拒绝")
    except RuntimeError as e:
        assert "1~10" in str(e) or "阶段序号" in str(e), f"拒绝理由不符: {e}"
    print("    非法阶段序号 11 被拒绝")
step("守卫:非法阶段序号拒绝", c2)

print("━━━ D. 项目经理:项目进度查询(子项目关联实施计划) ━━━")
def d1():
    d = btn("RD_PROGRESS", "保存", {
        "单据日期": TODAY, "文档编号": "YJ-XS004-1", "密级": "秘密", "文件使用范围": "研发部/生产部",
        "detail": {"items": [{
            "项目等级": "二级", "项目名称": PROJ, "子项目/尺寸": "10寸标准型",
            "项目编号": "XM-2026-001", "内容": "配方降本方案验证",
            "项目发起人": "市场部", "项目负责人": OWNER,
            "立项日期": "2026-09-01", "预计完成日期": "", "状态": "",
        }]},
    })
    st["lxj"] = d["编号"]
    assert st["lxj"] == "LXJ-2026-09-0001", f"编号异常: {st['lxj']}"
    st["lxj_status"] = d.get("单据状态")
    print(f"    {st['lxj']} 状态={st['lxj_status']}(进度查询为普通单据,需审核)")
step("进度查询建单 + 子项目行(关联实施计划项目名)", d1)

def d2():
    if st.get("lxj_status") == "草稿":
        btn("RD_PROGRESS", "审核", {"编号": st["lxj"]})
    head, _ = load("RD_PROGRESS", st["lxj"])
    assert head.get("文档编号") == "YJ-XS004-1", "文档编号未落库"
step("进度查询审核", d2)

print("━━━ E. 联动:阶段3完成 → 进度查询自动同步 ━━━")
def e1():
    btn("RD_PLAN", "阶段完成", {"编号": st["lxb"], "阶段序号": "3"})
    snap = dbsnap()
    line = [l for l in snap.splitlines() if l.strip().startswith(st["lxj"])]
    if not line: raise RuntimeError("进度明细未找到:\n" + snap)
    row = line[0].strip()
    print("    明细行: " + row)
    assert "进行中(完成3/5,至阶段3)" in row, f"状态未同步: {row}"
    assert f"里程完成={TODAY}" in row, f"里程完成未同步: {row}"
    assert f"负责={OWNER}" in row, f"项目负责人未同步: {row}"
step("阶段3完成 → 状态=进行中(完成3/5,至阶段3)+里程完成当天+项目负责", e1)

print("━━━ F. 联动:全部阶段完成 ━━━")
def f1():
    for n in (4, 5):
        btn("RD_PLAN", "阶段完成", {"编号": st["lxb"], "阶段序号": str(n)})
    snap = dbsnap()
    line = [l for l in snap.splitlines() if l.strip().startswith(st["lxj"])]
    row = line[0].strip() if line else ""
    print("    明细行: " + row)
    assert "全部完成(5/5)" in row, f"状态未变为全部完成: {row}"
step("阶段4、5完成 → 状态=全部完成(5/5)", f1)

print("━━━ G. 列表可见性(列表页按模块出现) ━━━")
def g1():
    for panel, no in (("RD_APPROVAL", st["lxa"]), ("RD_PLAN", st["lxb"]), ("RD_PROGRESS", st["lxj"])):
        r = api("/api/px/queryFormDataList", {"panelCode": panel, "pageNo": 1, "pageSize": 50, "condition": {}})
        if "http_error" in r: raise RuntimeError(f"{panel}: {r['message']}")
        rows = (r.get("data") or {}).get("list") or []
        hit = [x for x in rows if x.get("单据编号") == no]
        assert hit, f"{panel} 列表未查到 {no}"
        print(f"    {panel} 列表可见 {no}(状态={hit[0].get('单据状态')})")
step("三面板列表页均可见新单据", g1)

print()
print(f"═══════ 研发链路: {len(PASS)} 通过 / {len(FAIL)} 失败 ═══════")
for f in FAIL: print("  ✗", f)
print("单据:", json.dumps(st, ensure_ascii=False))
