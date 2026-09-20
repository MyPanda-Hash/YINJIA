// 一次性验证:GFDA 修复后 getPanelConfig 字段数/显隐/排序 + 列表数据
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  }).then(r => r.json());
  const token = login.data.token;
  const H = { Authorization: 'Bearer ' + token };
  const cfg = await fetch(BASE + '/px/getPanelConfig?panelCode=GFDA', { headers: H }).then(r => r.json());
  const tab = cfg.data.detail.tabs[0];
  const fs = tab.fields || [];
  const vis = fs.filter(f => f.hidden !== true && f.visible !== false);
  console.log(`fields=${fs.length} visible=${vis.length}`);
  console.log('前12个字段(按序):', fs.slice(0, 12).map(f => `${f.dataName}${f.hidden === true ? '(隐)' : ''}`).join(' | '));
  const nine = ['供应商编码', '供应商名称', '地址', '电话', '业务员', '税号', '开户行', '银行账号', '备注'];
  for (const label of nine) {
    const f = fs.find(x => x.dataName === label);
    console.log(`  ${label}: ${f ? ('hidden=' + f.hidden + ' visible=' + f.visible) : 'MISSING!'}`);
  }
  const list = await fetch(BASE + '/px/queryFormDataList', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode: 'GFDA', pageNo: 1, pageSize: 3 })
  }).then(r => r.json());
  console.log('list code=', list.code, 'totalSize=', list.data && list.data.totalSize);
  const row = list.data && list.data.list && list.data.list[0];
  if (row && row.detail && row.detail[0]) {
    const d = row.detail[0];
    console.log('首行明细抽样: 编号=%s 名称=%s 电话=%s 业务员=%s', d['供应商编码'], d['供应商名称'], d['电话'], d['业务员']);
  }
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
