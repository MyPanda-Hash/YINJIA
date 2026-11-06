# -*- coding: utf-8 -*-
"""独立复核 F:8090 面板/取数口径活体探针(自写 urllib,不复用 lead 的 _probe-panel-api.py)。
只读:仅 GET/POST 查询接口,不做保存/提交。
"""
import json, os, urllib.request, urllib.parse
from decimal import Decimal

BASE = 'http://127.0.0.1:8090'
V = r'D:\workspace\yinjia\tools\archive\_asm-bom-import-full-20261105\verify-independent'
OUT = []

def p(*a):
    s = ' '.join(str(x) for x in a); OUT.append(s); print(s)

TOKEN = ''
def call(method, path, body=None):
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header('Content-Type', 'application/json; charset=utf-8')
    if TOKEN:
        req.add_header('Authorization', 'Bearer ' + TOKEN)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))

login = call('POST', '/api/auth/login', {'userName': 'admin', 'password': '123456'})
TOKEN = (login.get('data') or {}).get('token') or ''
p('F1 登录: code=%s token=%s user=%s' % (login.get('code'), '有' if TOKEN else '无',
    (login.get('data') or {}).get('user', {}).get('realName')))

cfg = call('GET', '/api/px/getPanelConfig?panelCode=ASM_BOM')
md = (cfg.get('data') or {}).get('metadata') or {}
p('F2 面板配置: code=%s panelCode=%s name=%s mode=%s' % (
    cfg.get('code'), md.get('panelCode'), md.get('panelName'), md.get('mode')))
p('     metadata keys=%s' % sorted(md.keys())[:20])
pg = (md.get('panelPageDto') or {})
p('     panelPageDto keys=%s' % list(pg.keys()))

cnt = call('POST', '/api/px/queryFormDataList', {'panelCode': 'ASM_BOM', 'pageNo': 1, 'pageSize': 1, 'countOnly': 'true'})
p('F3 列表 countOnly: code=%s data=%s' % (cnt.get('code'), json.dumps(cnt.get('data'), ensure_ascii=False)[:300]))

page1 = call('POST', '/api/px/queryFormDataList', {'panelCode': 'ASM_BOM', 'pageNo': 1, 'pageSize': 3})
d = page1.get('data') or {}
rows = d.get('rows') or d.get('list') or []
p('F4 列表第一页: code=%s data.keys=%s total=%s rows=%d' % (
    page1.get('code'), sorted(d.keys()), d.get('totalSize', d.get('total')), len(rows)))
for r in rows[:3]:
    p('     %s' % {k: r.get(k) for k in ('单据编号', '产品编码', '产品名称', '工序', '版本号', '状态', '默认BOM')})

q = call('POST', '/api/px/queryFormDataList', {'panelCode': 'ASM_BOM', 'pageNo': 1, 'pageSize': 50,
                                               'condition': {'产品编码': 'A-48-05'}})
dq = q.get('data') or {}
rq = dq.get('rows') or dq.get('list') or []
p('F5 产品 A-48-05 单据: code=%s totalSize=%s 单据=%s' % (
    q.get('code'), dq.get('totalSize', dq.get('total')), [r.get('单据编号') for r in rq]))

# 单据详情:A-48-05_V0002 = 9 行,逐字段对 Excel
fd = call('GET', '/api/px/getFormDescriptor?panelCode=ASM_BOM&code=' + urllib.parse.quote('A-48-05_V0002'))
dd = fd.get('data') or {}
items = (dd.get('detailData') or {}).get('items') or []
head = dd.get('data') or {}
p('F6 单据 A-48-05_V0002: code=%s 表头单据编号=%s 版本号=%s 明细行=%d' % (
    fd.get('code'), head.get('单据编号'), head.get('版本号'), len(items)))
exp = json.load(open(os.path.join(V, 'excel-parsed.json'), encoding='utf-8'))['rows']
exp = [e for e in exp if e['单据编号'] == 'A-48-05_V0002']
exp.sort(key=lambda e: e['行序'])
p('     Excel 中该单 expected 行数=%d' % len(exp))
bad = 0
for got, e in zip(items, exp):
    diffs = []
    for f in ('行序', '子件编码', '子件名称', '子件规格', '计量单位', '标准用量', '行备注', '备注'):
        gv = got.get(f)
        ev = e.get(f)
        if f in ('标准用量',):
            ok = gv is not None and Decimal(str(gv)) == Decimal(str(ev))
        elif f == '行序':
            ok = int(gv) == int(ev)
        elif f == '计量单位':
            ok = (gv or None) == (e.get('分子单位') or None)  # 本地实测 分子单位 与 bs_inv.计量单位 0 差异
        else:
            ok = (gv if gv != '' else None) == (ev if ev != '' else None)
        if not ok:
            diffs.append('%s: api=%r excel=%r' % (f, gv, ev))
    if diffs:
        bad += 1
        p('     [DIFF] 行%d %s' % (int(e['行序']), '; '.join(diffs)))
p('F6 明细逐字段比对: 不一致行=%d/%d' % (bad, min(len(items), len(exp))))
for it in items[:10]:
    p('     %s' % {k: it.get(k) for k in ('行序', '子件编码', '子件名称', '计量单位', '标准用量', '行备注')})

# 多版本取数口径:与后端同 SQL 的口径由 DB 侧给出(q8),这里核对默认BOM单也能取到明细
fd2 = call('GET', '/api/px/getFormDescriptor?panelCode=ASM_BOM&code=' + urllib.parse.quote('B-38-17_V0001'))
dd2 = fd2.get('data') or {}
items2 = (dd2.get('detailData') or {}).get('items') or []
head2 = dd2.get('data') or {}
p('F7 默认BOM单 B-38-17_V0001: code=%s 默认BOM=%r 明细行=%d' % (
    fd2.get('code'), head2.get('默认BOM'), len(items2)))

with open(os.path.join(V, 'out-F-panel-api.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(OUT) + '\n')
print('[saved] out-F-panel-api.txt')
