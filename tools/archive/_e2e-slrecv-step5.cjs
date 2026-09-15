// _e2e-slrecv-step5.cjs — 附件 E2E(上传到 附件1 列位→头列同步→列表→删除→头列清空) + EN 译名核验
const BASE = 'http://127.0.0.1:8090/api';
const { poNo, slNo, ijNo } = require('./_slrecv-e2e.json');
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const H = { Authorization: 'Bearer ' + login.data.token };

  // 1) 上传(node FormData,UTF-8 安全)
  const fd = new FormData();
  fd.append('panelCode', 'SL_RECV');
  fd.append('docNo', slNo);
  fd.append('field', '附件1');
  fd.append('file', new File([Buffer.from('送料暂收单附件E2E测试内容')], '送料暂收-E2E.txt', { type: 'text/plain' }));
  const up = await fetch(BASE + '/attachment/upload', { method: 'POST', headers: H, body: fd }).then((r) => r.json());
  console.log('1) 上传:', JSON.stringify(up));
  const attId = up.data?.files?.[0]?.id ?? up.data?.id;

  // 2) 头列同步断言
  const view = await fetch(BASE + '/px/getFormDescriptor?panelCode=SL_RECV&code=' + encodeURIComponent(slNo), { headers: H }).then((r) => r.json());
  const v1 = (view.data?.data ?? view.data)['附件1'];
  console.log('2) sl_recv.附件1 =', JSON.stringify(v1), v1 === '送料暂收-E2E.txt' ? 'PASS' : 'FAIL');

  // 3) 列表
  const list = await fetch(BASE + '/attachment/list?panelCode=SL_RECV&docNo=' + encodeURIComponent(slNo) + '&field=' + encodeURIComponent('附件1'), { headers: H }).then((r) => r.json());
  console.log('3) 列表:', JSON.stringify(list.data?.map?.((x) => x.name ?? x.fileName ?? x.original_name)));

  // 4) 删除 → 头列清空断言
  const del = await fetch(BASE + '/attachment/delete', {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: attId }),
  }).then((r) => r.json());
  console.log('4) 删除:', JSON.stringify(del));
  const view2 = await fetch(BASE + '/px/getFormDescriptor?panelCode=SL_RECV&code=' + encodeURIComponent(slNo), { headers: H }).then((r) => r.json());
  const v2 = (view2.data?.data ?? view2.data)['附件1'];
  console.log('   删除后附件1 =', JSON.stringify(v2), (v2 ?? '') === '' ? 'PASS' : 'FAIL');

  // 5) EN 译名核验(Accept-Language: en → 面板名/列名英文)
  const en = await fetch(BASE + '/px/getPanelConfig?panelCode=SL_RECV', { headers: { ...H, 'Accept-Language': 'en' } }).then((r) => r.json());
  const meta = en.data?.metadata ?? en.data ?? {};
  console.log('5) EN panelName:', meta.panelName ?? en.data?.panelName, '| sample columns:',
    JSON.stringify((meta.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns ?? []).slice(0, 3).map((c) => c.label ?? c.title ?? c.dataName)));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
