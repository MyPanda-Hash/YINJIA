// _probe-slrecv-ref.cjs — 复现采购订单选存货链路上的接口,找 207 '数据来源' 来源
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };

  const tries = [
    ['INV 列表(选存货主查询)', '/px/queryFormDataList', { panelCode: 'INV', pageNo: 1, pageSize: 3, condition: {} }],
    ['PU_ORDER 列表', '/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 3, condition: {} }],
    ['OTHER_OUT 列表', '/px/queryFormDataList', { panelCode: 'OTHER_OUT', pageNo: 1, pageSize: 3, condition: {} }],
    ['PU_ORDER 表单描述符', null, null],
  ];
  for (const [name, path, body] of tries) {
    if (!path) continue;
    const r = await fetch(BASE + path, { method: 'POST', headers: H, body: JSON.stringify(body) }).then((x) => x.json());
    const ok = r.code === 200;
    console.log(name, '->', r.code, ok ? 'OK total=' + (r.data?.totalSize ?? r.data?.total) : String(r.message).slice(0, 400));
  }
  const fd = await fetch(BASE + '/px/getFormDescriptor?panelCode=PU_ORDER&code=PO-2026-09-0009', { headers: H }).then((x) => x.json());
  console.log('PU_ORDER 表单描述符 ->', fd.code, fd.code === 200 ? 'OK' : String(fd.message).slice(0, 400));
  const mx = await fetch(BASE + '/px/getNewFormPermMatrix?panelCode=PU_ORDER', { headers: H }).then((x) => x.json());
  console.log('PU_ORDER 矩阵 ->', mx.code, mx.code === 200 ? 'OK' : String(mx.message).slice(0, 400));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
