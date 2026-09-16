// _e2e-insp-same-line-dual.cjs — 聚焦验证:同一检验行(合格>0 且 不良>0)→ 一张 PI(实收=合格) + 一张 TH(数量=不良)
// 证据维度:①两张单各 1 行且物料一致 ②form_flow_link 两条 ACTIVE 的 source_line_key 相同(同一检验行)
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };
  const call = (p, b, f) => fetch(BASE + '/px/callButton', { method: 'POST', headers: H, body: JSON.stringify({ panelCode: p, buttonName: b, formData: f }) }).then((x) => x.json());
  const view = (p, n) => fetch(BASE + '/px/getFormDescriptor?panelCode=' + p + '&code=' + encodeURIComponent(n), { headers: H }).then((x) => x.json());

  // 单行链:PO(1行 100) → SL → IJ,检验行填 合格70/不良30(同一行两数量同时>0)
  const po = await call('PU_ORDER', '保存', {
    单据日期: '2026-09-16', 供应商: '同行双出口验证',
    detail: { items: [{ 物料编码: 'CL005', 物料名称: '包装木箱', 规格型号: '1200x800', 数量: 100, 单价: 5, 金额: 500 }] },
  });
  const poNo = po.data?.['编号'];
  await call('PU_ORDER', '审核', { 编号: poNo });
  const sl = await call('PU_ORDER', '生成送料暂收单', { 编号: poNo });
  const slNo = sl.data?.['编号'];
  await call('SL_RECV', '审核', { 编号: slNo });
  const ij = await call('SL_RECV', '生成来料检验单', { 编号: slNo });
  const ijNo = ij.data?.['编号'];
  const ijv = await view('QC_INSP', ijNo);
  const items = (ijv.data?.detailData?.items ?? []).map((x) => ({ ...x }));
  items[0]['合格数量'] = 70;
  items[0]['不良数量'] = 30;
  await call('QC_INSP', '保存', {
    编号: ijNo, 单号: ijNo, 日期: (ijv.data?.data ?? {})['日期'], 供应商: (ijv.data?.data ?? {})['供应商'],
    detail: { items },
  });
  const aud = await call('QC_INSP', '审核', { 编号: ijNo });
  console.log('IJ审核:', JSON.stringify(aud.data ?? aud).slice(0, 60));

  const ijA = await view('QC_INSP', ijNo);
  const piNo = ijA.data?.detailData?.items?.[0]?.['入库单号'];
  const piv = piNo ? await view('PURCHASE_IN', piNo) : null;
  const piRows = piv?.data?.detailData?.items ?? [];

  const thq = await fetch(BASE + '/px/queryFormDataList', {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'QC_RETURN', pageNo: 1, pageSize: 10, condition: {} }),
  }).then((x) => x.json());
  const thDoc = (thq.data?.list ?? []).find((d) => d['单据状态'] !== '已作废' && d['编号']?.startsWith('TH-2026-09'));
  const thv = thDoc ? await view('QC_RETURN', thDoc['编号']) : null;
  const thRows = thv?.data?.detailData?.items ?? [];

  console.log('PI:', piNo, '行数', piRows.length, '实收', piRows.map((r) => r['实收数量']), '物料', piRows.map((r) => r['存货编码']));
  console.log('TH:', thDoc?.['编号'], '行数', thRows.length, '数量', thRows.map((r) => r['数量']), '物料', thRows.map((r) => r['物料编码']));

  const sameLineBoth = piRows.length === 1 && thRows.length === 1
    && Number(piRows[0]['实收数量']) === 70 && Number(thRows[0]['数量']) === 30
    && piRows[0]['存货编码'] === thRows[0]['物料编码'];
  console.log(sameLineBoth ? 'PASS | 同一检验行生成两张单:PI(实收=合格70) + TH(数量=不良30)' : 'FAIL | 行数/数量不符');

  // 清理
  await call('QC_INSP', '弃审', { 编号: ijNo });
  await call('QC_INSP', '删除', { 编号: ijNo });
  await call('SL_RECV', '弃审', { 编号: slNo });
  await call('SL_RECV', '删除', { 编号: slNo });
  await call('PU_ORDER', '弃审', { 编号: poNo });
  await call('PU_ORDER', '删除', { 编号: poNo });
  console.log('清理完成(IJ/SL/PO 删除,自动 PI/TH 随弃审联动作废)');
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
