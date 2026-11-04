# -*- coding: utf-8 -*-
"""一次性只读探针:登录 8090,核验组装物料清单(ASM_BOM)面板确实看到全量导入的数据。"""
import json
import sys
import urllib.request

BASE = 'http://127.0.0.1:8090'
TOKEN = ''


def call(method, path, body=None):
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header('Content-Type', 'application/json; charset=utf-8')
    if TOKEN:
        req.add_header('Authorization', 'Bearer ' + TOKEN)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode('utf-8'))


def main():
    global TOKEN
    login = call('POST', '/api/auth/login', {'userName': 'admin', 'password': '123456'})
    TOKEN = (login.get('data') or {}).get('token') or ''
    print(f"[1] 登录: code={login.get('code')} token={'有' if TOKEN else '无'} user={(login.get('data') or {}).get('realName') or (login.get('data') or {}).get('userName')}")

    # 面板元数据
    cfg = call('GET', '/api/px/getPanelConfig?panelCode=ASM_BOM')
    md = (cfg.get('data') or {}).get('metadata') or {}
    print(f"[2] 面板: code={cfg.get('code')} panelCode={md.get('panelCode')} name={md.get('panelName')} pageSize={(md.get('panelPageDto') or {}).get('tablePages', [{}])[0].get('pageSize')}")

    # 列表总数(countOnly)
    cnt = call('POST', '/api/px/queryFormDataList', {'panelCode': 'ASM_BOM', 'pageNo': 1, 'pageSize': 1, 'countOnly': 'true'})
    print(f"[3] 列表 countOnly: code={cnt.get('code')} data={json.dumps(cnt.get('data'), ensure_ascii=False)[:200]}")

    # 列表第一页
    page1 = call('POST', '/api/px/queryFormDataList', {'panelCode': 'ASM_BOM', 'pageNo': 1, 'pageSize': 3})
    d = page1.get('data') or {}
    print(f"[4] 列表第一页: code={page1.get('code')} keys={list(d.keys())} total={d.get('total')} rows={len(d.get('rows') or d.get('list') or [])}")
    rows = d.get('rows') or d.get('list') or []
    for r in rows[:3]:
        print('    ', {k: r.get(k) for k in ('单据编号', '产品编码', '产品名称', '工序', '版本号', '状态')})

    # 多版本产品:A-48-05 应有 2 张 BOM
    q = call('POST', '/api/px/queryFormDataList', {'panelCode': 'ASM_BOM', 'pageNo': 1, 'pageSize': 50, 'condition': {'产品编码': 'A-48-05'}})
    dq = q.get('data') or {}
    rq = dq.get('rows') or dq.get('list') or []
    print(f"[5] 产品 A-48-05 的 BOM 单: code={q.get('code')} total={dq.get('total')} 单据={[r.get('单据编号') for r in rq]}")

    # 单据详情:A-48-05_V0002 的明细行
    try:
        fd = call('GET', '/api/px/getFormDescriptor?panelCode=ASM_BOM&code=A-48-05_V0002')
        dd = fd.get('data') or {}
        items = (dd.get('detailData') or {}).get('items') or []
        print(f"[6] 单据 A-48-05_V0002: code={fd.get('code')} 表头={json.dumps(dd.get('data') or {}, ensure_ascii=False)[:260]}")
        print(f"    明细行={len(items)}")
        for it in items[:10]:
            print('    ', {k: it.get(k) for k in ('行序', '子件编码', '子件名称', '计量单位', '标准用量')})
    except Exception as e:  # noqa: BLE001
        print(f"[6] 单据详情异常: {e}")


if __name__ == '__main__':
    sys.exit(main())
