// _e2e-approval-autogen.cjs — 终验(2026-09-16 修复后):
// ①审批路径(提交审批→审批通过)自动生成 PI(实收=合格)+TH(数量=不良)+回填
// ②手工生单按钮已移除(配置无生单组;直调按钮被拒)
// ③清理此前复现链(IJ-0012);④恢复用户 IJ-0011(弃审→联动作废错误的 PI-0024)
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };
  const call = (p, b, f) => fetch(BASE + '/px/callButton', { method: 'POST', headers: H, body: JSON.stringify({ panelCode: p, buttonName: b, formData: f }) }).then((x) => x.json());
  const view = (p, n) => fetch(BASE + '/px/getFormDescriptor?panelCode=' + p + '&code=' + encodeURIComponent(n), { headers: H }).then((x) => x.json());
  const R = [];
  const chk = (n, p, d) => { R.push(p); console.log((p ? 'PASS' : 'FAIL') + ' | ' + n + (d ? ' | ' + d : '')); };

  // ── ① 审批路径自动生单(用户原始数字:5101/合格100/不良100 + 200/合格100)
  const po = await call('PU_ORDER', '保存', {
    单据日期: '2026-09-16', 供应商: '审批路径验证',
    detail: { items: [
      { 物料编码: 'CL005', 物料名称: '包装木箱', 规格型号: '1200x800', 数量: 5101, 单价: 1, 金额: 5101 },
      { 物料编码: 'CL005', 物料名称: '包装木箱', 规格型号: '1200x800', 数量: 200, 单价: 1, 金额: 200 },
    ] },
  });
  const poNo = po.data?.['编号'];
  await call('PU_ORDER', '审核', { 编号: poNo });
  const slNo = (await call('PU_ORDER', '生成送料暂收单', { 编号: poNo })).data?.['编号'];
  await call('SL_RECV', '审核', { 编号: slNo });
  const ijNo = (await call('SL_RECV', '生成来料检验单', { 编号: slNo })).data?.['编号'];
  const v = await view('QC_INSP', ijNo);
  const items = (v.data?.detailData?.items ?? []).map((x) => ({ ...x }));
  items[0]['合格数量'] = 100; items[0]['不良数量'] = 100;
  items[1]['合格数量'] = 100;
  await call('QC_INSP', '保存', { 编号: ijNo, 单号: ijNo, 日期: v.data?.data?.['日期'], 供应商: v.data?.data?.['供应商'], detail: { items } });
  const sub = await call('QC_INSP', '提交审批', { 编号: ijNo });
  const app = await call('QC_INSP', '审批通过', { 编号: ijNo });
  chk('1.提交审批+审批通过', sub.code === 200 && app.code === 200 && app.data?.['单据状态'] === '已审核', JSON.stringify(app.data ?? app).slice(0, 60));

  const a = await view('QC_INSP', ijNo);
  const piNo = a.data?.detailData?.items?.[0]?.['入库单号'];
  const backfilled = (a.data?.detailData?.items ?? []).every((r) => r['入库单号'] === piNo);
  const pv = piNo ? await view('PURCHASE_IN', piNo) : null;
  const piQty = (pv?.data?.detailData?.items ?? []).map((r) => Number(r['实收数量']));
  chk('2.审批路径自动PI+回填', !!piNo && backfilled, piNo + ' 回填=' + backfilled);
  chk('3.PI实收=合格数量', piQty.length === 2 && piQty[0] === 100 && piQty[1] === 100, JSON.stringify(piQty));

  const thq = await fetch(BASE + '/px/queryFormDataList', {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'QC_RETURN', pageNo: 1, pageSize: 20, condition: {} }),
  }).then((x) => x.json());
  const liveTh = (thq.data?.list ?? []).filter((d) => d['单据状态'] !== '已作废');
  const thv = liveTh[0] ? await view('QC_RETURN', liveTh[0]['编号']) : null;
  const thQty = (thv?.data?.detailData?.items ?? []).map((r) => Number(r['数量']));
  chk('4.审批路径自动TH(数量=不良)', liveTh.length >= 1 && thQty.length === 1 && thQty[0] === 100, liveTh[0]?.['编号'] + ' ' + JSON.stringify(thQty));

  // ── ② 手工按钮移除
  const cfg = await fetch(BASE + '/px/getPanelConfig?panelCode=QC_INSP', { headers: H }).then((x) => x.json());
  const groups = cfg.data?.metadata?.buttonGroups ?? [];
  const hasGen = JSON.stringify(groups).includes('生成采购入库单') || JSON.stringify(groups).includes('生成暂收退回单');
  chk('5.工具栏无手工生单按钮', !hasGen, '组=' + groups.map((g) => g.name).join('/'));
  const manual = await call('QC_INSP', '生成采购入库单', { 编号: ijNo });
  chk('6.直调手工生单被拒', manual.code !== 200, String(manual.message).slice(0, 60));

  // ── ③ 清理本轮 + 此前复现链
  await call('QC_INSP', '弃审', { 编号: ijNo });
  await call('QC_INSP', '删除', { 编号: ijNo });
  await call('SL_RECV', '弃审', { 编号: slNo });
  await call('SL_RECV', '删除', { 编号: slNo });
  await call('PU_ORDER', '弃审', { 编号: poNo });
  await call('PU_ORDER', '删除', { 编号: poNo });
  const prev = require('./_dual-repro-nos.json');
  const c1 = await call('QC_INSP', '弃审', { 编号: prev.ijNo });
  const c2 = c1.code === 200 ? await call('QC_INSP', '删除', { 编号: prev.ijNo }) : { code: c1.code };
  await call('SL_RECV', '弃审', { 编号: prev.slNo }).catch(() => {});
  const c3 = await call('SL_RECV', '删除', { 编号: prev.slNo });
  await call('PU_ORDER', '弃审', { 编号: prev.poNo }).catch(() => {});
  const c4 = await call('PU_ORDER', '删除', { 编号: prev.poNo });
  chk('7.清理复现链(IJ-0012)', c2.code === 200 && c3.code === 200 && c4.code === 200, [c2.code, c3.code, c4.code].join('/'));

  // ── ④ 恢复用户 IJ-0011(弃审→联动作废错误的 PI-0024;数据保留待用户重审)
  const u = await call('QC_INSP', '弃审', { 编号: 'IJ-2026-09-0011' });
  const pi24 = await view('PURCHASE_IN', 'PI-2026-09-0024');
  chk('8.用户IJ-0011已弃审+错误PI-0024作废', u.code === 200 && pi24.data?.data?.['单据状态'] === '已作废',
    'IJ=' + JSON.stringify(u.data ?? u).slice(0, 50) + ' PI24=' + pi24.data?.data?.['单据状态']);

  const fails = R.filter((x) => !x).length;
  console.log('== 总结: ' + (R.length - fails) + '/' + R.length + ' PASS');
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
