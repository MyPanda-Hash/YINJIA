// _e2e-insp-auto-step2.cjs — 守卫分支:生成的入库单已审核 → 弃审检验单应被拒;弃审入库单(冲回台账)后可弃审
const BASE = 'http://127.0.0.1:8090/api';
const NO = 'IJ-2026-09-0006';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const H = { Authorization: 'Bearer ' + login.data.token, 'Content-Type': 'application/json' };
  const post = (p, b) => fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json());
  const call = (panel, btn, formData) => post('/px/callButton', { panelCode: panel, buttonName: btn, formData });
  const list = await post('/px/queryFormDataList', { panelCode: 'PURCHASE_IN', pageNo: 1, pageSize: 50, condition: {} });
  const pi = (list.data?.list ?? []).find((x) => x['外部单据号'] === NO);
  if (!pi) throw new Error('未找到自动生成的入库单');
  const piNo = pi['编号'];
  console.log('入库单:', piNo, pi['单据状态']);

  // 1) 审核入库单(记台账)
  const aud = await call('PURCHASE_IN', '审核', { 编号: piNo });
  console.log('1) 审核入库单:', JSON.stringify(aud));

  // 2) 弃审检验单应被拒
  const blocked = await call('QC_INSP', '弃审', { 编号: NO });
  console.log('2) 弃审检验单(应409拒绝):', JSON.stringify(blocked));
  console.log('   守卫断言:', blocked.code === 409 && String(blocked.message || '').includes('先弃审') ? 'PASS' : 'FAIL');

  // 3) 弃审入库单(冲回台账) → 检验单可弃审;再弃审检验单 → 入库单作废
  const piUn = await call('PURCHASE_IN', '弃审', { 编号: piNo });
  console.log('3) 弃审入库单:', JSON.stringify(piUn));
  const ijUn = await call('QC_INSP', '弃审', { 编号: NO });
  console.log('   弃审检验单(联动作废入库单):', JSON.stringify(ijUn));
  const list2 = await post('/px/queryFormDataList', { panelCode: 'PURCHASE_IN', pageNo: 1, pageSize: 50, condition: {} });
  console.log('   入库单已作废不可见:', (list2.data?.list ?? []).some((x) => x['编号'] === piNo) ? 'FAIL' : 'PASS');

  // 4) 恢复演示终态:重审检验单 → 新入库单草稿
  const re = await call('QC_INSP', '审核', { 编号: NO });
  const list3 = await post('/px/queryFormDataList', { panelCode: 'PURCHASE_IN', pageNo: 1, pageSize: 50, condition: {} });
  const piNew = (list3.data?.list ?? []).find((x) => x['外部单据号'] === NO);
  console.log('4) 重审检验单:', re.data?.['单据状态'], '| 新入库单:', piNew?.['编号'], piNew?.['单据状态']);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
