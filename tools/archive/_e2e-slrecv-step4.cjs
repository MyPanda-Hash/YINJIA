// _e2e-slrecv-step4.cjs — 送料暂收单全链路 E2E:
// 建测试PO→审核→生单SL→查SL落库→审核SL→生成IJ→查IJ镜像→SL弃审→改数量保存→验IJ同步→删行→验IJ软删
// 每步打印关键断言;测试单号记录到 /tmp/slrecv-e2e.json 供清理脚本使用
const fs = require('fs');
const BASE = 'http://127.0.0.1:8090/api';
async function api(H, path, body, isForm) {
  const r = await fetch(BASE + path, {
    method: body || isForm ? 'POST' : 'GET',
    headers: isForm ? H : { ...H, 'Content-Type': 'application/json' },
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  }).then((x) => x.json());
  return r;
}
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const H = { Authorization: 'Bearer ' + login.data.token };
  const call = (panel, btn, formData) => api(H, '/px/callButton', { panelCode: panel, buttonName: btn, formData });

  // 按钮组断言(SL_RECV 应有 选单/生成来料检验单;PU_ORDER 生单组应含 生成送料暂收单 且不在 disabled)
  for (const pc of ['SL_RECV', 'PU_ORDER']) {
    const m = await api(H, '/px/getPanelConfig?panelCode=' + pc);
    const meta = m.data?.metadata ?? m.data ?? {};
    const groups = meta.buttonGroups ?? m.data?.buttonGroups ?? [];
    const flat = groups.flatMap((g) => g.actions ?? g.buttons ?? [g.name ?? g]);
    console.log(pc, 'buttonGroups:', JSON.stringify(groups).slice(0, 600));
    console.log(pc, 'disabledActions:', JSON.stringify(meta.disabledActions ?? m.data?.disabledActions ?? []));
    console.log(pc, 'selectConfig.source:', (m.data?.selectConfig ?? meta.selectConfig ?? {}).source);
  }

  // 1) 新建测试采购订单(两行,第二行用于后续删除同步)
  const poSave = await call('PU_ORDER', '保存', {
    单据日期: '2026-09-15', 供应商: '北方机械',
    detail: { items: [
      { 物料编码: 'CL005', 物料名称: '包装木箱', 规格型号: '1200×800', 数量: 100, 单价: 5, 金额: 500 },
      { 物料编码: 'CL005', 物料名称: '包装木箱', 规格型号: '1200×800', 数量: 20, 单价: 5, 金额: 100 },
    ] },
  });
  console.log('1) PO保存:', JSON.stringify(poSave));
  const poNo = poSave.data?.['编号'] ?? poSave.data?.no;
  if (!poNo) throw new Error('PO 创建失败');

  // 2) 审核 PO
  const poAudit = await call('PU_ORDER', '审核', { 编号: poNo });
  console.log('2) PO审核:', JSON.stringify(poAudit));

  // 3) 生单 → 送料暂收单
  const gen = await call('PU_ORDER', '生成送料暂收单', { 编号: poNo });
  console.log('3) 生成送料暂收单:', JSON.stringify(gen));
  const slNo = gen.data?.['编号'];
  if (!slNo) throw new Error('生单失败:' + JSON.stringify(gen));

  // 4) SL 审核前先看一眼单据内容(数量/型号带入断言)
  const slView = await api(H, '/px/getFormDescriptor?panelCode=SL_RECV&code=' + encodeURIComponent(slNo));
  const slData = slView.data?.data ?? slView.data ?? {};
  console.log('4) SL头:', JSON.stringify({ 单号: slData['单号'], 日期: slData['日期'], 供应商: slData['供应商'], 数量: slData['数量'] }));
  console.log('   SL明细:', JSON.stringify(slView.data?.detailData?.items ?? slView.detailData?.items));

  // 5) 审核 SL
  const slAudit = await call('SL_RECV', '审核', { 编号: slNo });
  console.log('5) SL审核:', JSON.stringify(slAudit));

  // 6) 生成来料检验单
  const genIj = await call('SL_RECV', '生成来料检验单', { 编号: slNo });
  console.log('6) 生成来料检验单:', JSON.stringify(genIj));
  const ijNo = genIj.data?.['编号'];
  if (!ijNo) throw new Error('生成检验单失败:' + JSON.stringify(genIj));
  const ijView = await api(H, '/px/getFormDescriptor?panelCode=QC_INSP&code=' + encodeURIComponent(ijNo));
  const ijData = ijView.data?.data ?? ijView.data ?? {};
  console.log('   IJ头:', JSON.stringify({ 单号: ijData['单号'], 日期: ijData['日期'], 供应商: ijData['供应商'], 数量: ijData['数量'] }));
  console.log('   IJ明细:', JSON.stringify(ijView.data?.detailData?.items ?? ijView.detailData?.items));

  // 7) SL 弃审 → 改行1数量 100→80、头供应商不变行备注变化 → 保存 → 断言 IJ 行1数量=80
  await call('SL_RECV', '弃审', { 编号: slNo });
  const slAgain = await api(H, '/px/getFormDescriptor?panelCode=SL_RECV&code=' + encodeURIComponent(slNo));
  const items = (slAgain.data?.detailData ?? slAgain.detailData).items.map((x) => ({ ...x }));
  items[0]['数量'] = 80;
  items[0]['备注'] = 'E2E同步修改';
  const slSave = await call('SL_RECV', '保存', {
    编号: slNo, 单号: slNo, 日期: slAgain.data?.data?.['日期'] ?? '2026-09-15', 供应商: slAgain.data?.data?.['供应商'],
    detail: { items },
  });
  console.log('7) SL修改保存:', JSON.stringify(slSave));
  const ijAfter = await api(H, '/px/getFormDescriptor?panelCode=QC_INSP&code=' + encodeURIComponent(ijNo));
  const ijItems = ijAfter.data?.detailData?.items ?? ijAfter.detailData?.items;
  console.log('   同步后IJ明细:', JSON.stringify(ijItems));
  const row1 = ijItems?.find((x) => x['数量'] === 80 || x['备注'] === 'E2E同步修改');
  console.log('   断言A(行级同步:数量80/备注带入):', row1 ? 'PASS' : 'FAIL');

  // 8) 删行1再保存 → 断言 IJ 对应行软删(只剩 20 的行)
  await call('SL_RECV', '弃审', { 编号: slNo });
  const slThird = await api(H, '/px/getFormDescriptor?panelCode=SL_RECV&code=' + encodeURIComponent(slNo));
  const remain = (slThird.data?.detailData ?? slThird.detailData).items.filter((x) => Number(x['数量']) !== 80);
  const slSave2 = await call('SL_RECV', '保存', {
    编号: slNo, 单号: slNo, 日期: slThird.data?.data?.['日期'] ?? '2026-09-15', 供应商: slThird.data?.data?.['供应商'],
    detail: { items: remain },
  });
  console.log('8) SL删行保存:', JSON.stringify(slSave2));
  const ijFinal = await api(H, '/px/getFormDescriptor?panelCode=QC_INSP&code=' + encodeURIComponent(ijNo));
  const ijFinalItems = ijFinal.data?.detailData?.items ?? ijFinal.detailData?.items;
  console.log('   删行后IJ明细:', JSON.stringify(ijFinalItems));
  console.log('   断言B(删行同步:IJ只剩20行):', ijFinalItems?.length === 1 && Number(ijFinalItems[0]['数量']) === 20 ? 'PASS' : 'FAIL');

  fs.writeFileSync(__dirname + '/_slrecv-e2e.json', JSON.stringify({ poNo, slNo, ijNo }));
  console.log('测试单号已记录:', { poNo, slNo, ijNo });
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
