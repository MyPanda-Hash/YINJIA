// _e2e-insp-auto-step1.cjs — 来料检验单改名+审核自动生成采购入库单 E2E(用测试单 IJ-2026-09-0006)
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
  const desc = (code) => fetch(BASE + '/px/getFormDescriptor?panelCode=QC_INSP&code=' + encodeURIComponent(code), { headers: H }).then((r) => r.json());

  // 0) 改名断言
  const cfg = await fetch(BASE + '/px/getPanelConfig?panelCode=QC_INSP', { headers: H }).then((r) => r.json());
  const meta = cfg.data?.metadata ?? cfg.data ?? {};
  const groups = meta.buttonGroups ?? cfg.data?.buttonGroups ?? [];
  console.log('0) panelName:', cfg.data?.panelName ?? meta.panelName, '| EN:', (await fetch(BASE + '/px/getPanelConfig?panelCode=QC_INSP', { headers: { ...H, 'Accept-Language': 'en' } }).then((r) => r.json()).then((x) => (x.data?.metadata ?? x.data ?? {}).panelName)));
  console.log('   选单组:', JSON.stringify(groups.find?.((g) => g.name === '选单') ?? '无'));

  // 1) 合格数量未填 → 审核:应成功且不生成入库单
  let d = await desc(NO);
  let items = (d.data?.detailData ?? d.detailData).items.filter((x) => x['合格数量'] == null || true);
  let save = await call('QC_INSP', '保存', {
    编号: NO, 单号: NO, 日期: d.data?.data?.['日期'] ?? '2026-09-15', 供应商: d.data?.data?.['供应商'],
    detail: { items: items.map((x) => ({ ...x, 合格数量: null })) },
  });
  console.log('1) 清空合格数量保存:', JSON.stringify(save));
  let aud = await call('QC_INSP', '审核', { 编号: NO });
  console.log('   审核(应无入库单生成):', JSON.stringify(aud));
  let piCount = await post('/px/queryFormDataList', { panelCode: 'PURCHASE_IN', pageNo: 1, pageSize: 50, condition: {} });
  const piNos = (piCount.data?.list ?? []).map((x) => x['编号'] + ':' + (x['外部单据号'] ?? x['编号'])).filter((s) => s.includes(NO));
  console.log('   外部单据号=' + NO + ' 的入库单:', JSON.stringify(piNos), piNos.length === 0 ? 'PASS(未生成)' : 'FAIL');

  // 2) 弃审 → 填合格数量18+仓库 → 审核:生成入库单草稿
  await call('QC_INSP', '弃审', { 编号: NO });
  d = await desc(NO);
  items = (d.data?.detailData ?? d.detailData).items.map((x) => ({ ...x, 合格数量: 18, 仓库代码: '成品仓' }));
  save = await call('QC_INSP', '保存', {
    编号: NO, 单号: NO, 日期: d.data?.data?.['日期'] ?? '2026-09-15', 供应商: d.data?.data?.['供应商'],
    detail: { items },
  });
  console.log('2) 填合格数量18保存:', JSON.stringify(save));
  aud = await call('QC_INSP', '审核', { 编号: NO });
  console.log('   审核:', JSON.stringify(aud));
  piCount = await post('/px/queryFormDataList', { panelCode: 'PURCHASE_IN', pageNo: 1, pageSize: 50, condition: {} });
  const pi = (piCount.data?.list ?? []).find((x) => x['外部单据号'] === NO);
  console.log('   生成的入库单:', pi ? JSON.stringify({ no: pi['编号'], 状态: pi['单据状态'], 供应商: pi['供应商'], 行: pi.detail?.items?.map((r) => ({ 存货编码: r['存货编码'], 规格型号: r['规格型号'], 实收数量: r['实收数量'], 仓库: r['仓库'] })) }) : 'FAIL 未找到');
  // 回填断言
  d = await desc(NO);
  const backfilled = (d.data?.detailData ?? d.detailData).items.filter((x) => Number(x['数量']) === 20);
  console.log('   检验行入库单号回填:', JSON.stringify(backfilled.map((x) => x['入库单号'])), backfilled.every((x) => String(x['入库单号'] || '').startsWith('PI-')) ? 'PASS' : 'FAIL');
  const piNo = pi?.['编号'];

  // 3) 弃审 → 入库单应作废+占用释放+回填清空
  const unaud = await call('QC_INSP', '弃审', { 编号: NO });
  console.log('3) 弃审检验单:', JSON.stringify(unaud));
  const piAfter = await post('/px/queryFormDataList', { panelCode: 'PURCHASE_IN', pageNo: 1, pageSize: 50, condition: {} });
  const piRow = (piAfter.data?.list ?? []).find((x) => x['编号'] === piNo);
  console.log('   入库单在列表(作废应不可见):', piRow ? 'FAIL 仍可见 ' + piRow['单据状态'] : 'PASS(已作废不可见)');
  d = await desc(NO);
  const cleared = (d.data?.detailData ?? d.detailData).items.filter((x) => Number(x['数量']) === 20);
  console.log('   回填清空:', JSON.stringify(cleared.map((x) => x['入库单号'])), cleared.every((x) => !x['入库单号']) ? 'PASS' : 'FAIL');

  // 4) 重审 → 重新生成入库单(占用已释放)
  aud = await call('QC_INSP', '审核', { 编号: NO });
  console.log('4) 重审:', JSON.stringify(aud));
  piCount = await post('/px/queryFormDataList', { panelCode: 'PURCHASE_IN', pageNo: 1, pageSize: 50, condition: {} });
  const piNew = (piCount.data?.list ?? []).find((x) => x['外部单据号'] === NO);
  console.log('   重新生成的入库单:', piNew ? piNew['编号'] + ' ' + piNew['单据状态'] : 'FAIL');
  console.log('   终态: 检验单', (await desc(NO)).data?.data?.['单据状态'], '入库单', piNew?.['编号'], piNew?.['单据状态']);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
