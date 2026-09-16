// _e2e-insp-autogen-both.cjs — 检验单审核自动生单(双出口)E2E 2026-09-16:
// PO审核→SL→审核→IJ(填合格/不良)→审核 → 应自动生成:PI(合格行,实收=合格,入库单号回填) + TH(不良行,数量=不良)
// 弃审IJ → 两草稿作废+回填清空+占用释放;重审 → 重新生成;最后全清理。
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };
  const call = (panelCode, buttonName, formData) =>
    fetch(BASE + '/px/callButton', { method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData }) }).then((x) => x.json());
  const view = (panel, no) =>
    fetch(BASE + '/px/getFormDescriptor?panelCode=' + panel + '&code=' + encodeURIComponent(no), { headers: H }).then((x) => x.json());
  const R = [];
  const chk = (name, pass, detail) => { R.push({ name, pass }); console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : '')); };

  // ── 链头:PO → SL → IJ
  const po = await call('PU_ORDER', '保存', {
    单据日期: '2026-09-16', 供应商: '双出口验证供应商',
    detail: { items: [
      { 物料编码: 'CL005', 物料名称: '包装木箱', 规格型号: '1200x800', 数量: 60, 单价: 5, 金额: 300 },
      { 物料编码: 'CL005', 物料名称: '包装木箱', 规格型号: '1200x800', 数量: 40, 单价: 5, 金额: 200 },
    ] },
  });
  const poNo = po.data?.['编号'];
  await call('PU_ORDER', '审核', { 编号: poNo });
  const sl = await call('PU_ORDER', '生成送料暂收单', { 编号: poNo });
  const slNo = sl.data?.['编号'];
  await call('SL_RECV', '审核', { 编号: slNo });
  const ij = await call('SL_RECV', '生成来料检验单', { 编号: slNo });
  const ijNo = ij.data?.['编号'];
  chk('0.链头 IJ 就绪', !!ijNo, poNo + '→' + slNo + '→' + ijNo);

  // ── 填检验结果:行1 合格50/不良10;行2 合格40/不良0
  const ijv = await view('QC_INSP', ijNo);
  const items = (ijv.data?.detailData?.items ?? []).map((x) => ({ ...x }));
  items[0]['合格数量'] = 50; items[0]['不良数量'] = 10; items[0]['备注'] = '行1部分不良';
  items[1]['合格数量'] = 40;
  const saved = await call('QC_INSP', '保存', {
    编号: ijNo, 单号: ijNo, 日期: (ijv.data?.data ?? {})['日期'], 供应商: (ijv.data?.data ?? {})['供应商'],
    detail: { items },
  });
  chk('1.填合格/不良保存', saved.code === 200, JSON.stringify(saved.data ?? saved).slice(0, 80));

  // ── 审核检验单 → 双自动生单
  const aud = await call('QC_INSP', '审核', { 编号: ijNo });
  chk('2.IJ审核', aud.code === 200 && aud.data?.['单据状态'] === '已审核', JSON.stringify(aud.data ?? aud).slice(0, 80));

  // 校验自动生成的 PI:应只有两行(都合格>0),实收数量=合格数量,入库单号回填
  const piNo = items[0] && (await view('QC_INSP', ijNo)).data?.detailData?.items?.[0]?.['入库单号'];
  const ijA = await view('QC_INSP', ijNo);
  const ijRows = ijA.data?.detailData?.items ?? [];
  const piv = piNo ? await view('PURCHASE_IN', piNo) : null;
  const piRows = piv?.data?.detailData?.items ?? [];
  const piHead = piv?.data?.data ?? {};
  chk('3.入库单号回填(两行同一张PI)', ijRows.length === 2 && ijRows.every((r) => r['入库单号'] && r['入库单号'] === ijRows[0]['入库单号']), piNo ?? '(未回填)');
  chk('4.PI行数=合格行数(2)', piRows.length === 2, JSON.stringify(piRows.map((r) => r['实收数量'])));
  chk('5.PI实收数量=合格数量', Number(piRows[0]?.['实收数量']) === 50 && Number(piRows[1]?.['实收数量']) === 40, JSON.stringify(piRows.map((r) => r['实收数量'])));
  chk('6.PI数据带入(存货/型号/头供应商/来源单号)',
    piRows[0]?.['存货编码'] === 'CL005' && piRows[0]?.['规格型号'] === '1200x800' && piHead['供应商'] === '双出口验证供应商' && piHead['来源单号'] === ijNo,
    '存货=' + piRows[0]?.['存货编码'] + ' 供应商=' + piHead['供应商'] + ' 来源=' + piHead['来源单号']);

  // 校验自动生成的 TH:只有行1(不良10)
  const thNoRaw = await fetch(BASE + '/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'QC_RETURN', pageNo: 1, pageSize: 50, condition: {} }),
  }).then((x) => x.json());
  const thDocs = (thNoRaw.data?.list ?? []).filter((d) => (d['编号'] || '').startsWith('TH-2026-09'));
  const thDoc = thDocs[0];
  const thv = thDoc ? await view('QC_RETURN', thDoc['编号']) : null;
  const thRows = thv?.data?.detailData?.items ?? [];
  const thHead = thv?.data?.data ?? {};
  chk('7.TH自动生成且仅不良行(1行)', thRows.length === 1 && Number(thRows[0]['数量']) === 10, thDoc?.['编号'] + ' 行数=' + thRows.length + ' 数量=' + thRows[0]?.['数量']);
  chk('8.TH数据带入(物料/型号/头供应商/部门链)', thRows[0]?.['物料编码'] === 'CL005' && thRows[0]?.['型号'] === '1200x800' && thHead['供应商'] === '双出口验证供应商', '物料=' + thRows[0]?.['物料编码'] + ' 供应商=' + thHead['供应商']);

  // ── 弃审 IJ → PI/TH 草稿作废 + 回填清空
  const un = await call('QC_INSP', '弃审', { 编号: ijNo });
  chk('9.弃审IJ', un.code === 200, JSON.stringify(un.data ?? un).slice(0, 60));
  const ijB = await view('QC_INSP', ijNo);
  const cleared = (ijB.data?.detailData?.items ?? []).every((r) => !r['入库单号']);
  const piSt = piNo ? String((await view('PURCHASE_IN', piNo)).data?.data?.['单据状态']) : '?';
  const thSt = thDoc ? String((await view('QC_RETURN', thDoc['编号'])).data?.data?.['单据状态']) : '?';
  chk('10.弃审联动(回填清空/PI作废/TH作废)', cleared && piSt === '已作废' && thSt === '已作废', '回填清=' + cleared + ' PI=' + piSt + ' TH=' + thSt);

  // ── 重审 → 重新生成(幂等释放后可再生成)
  const re = await call('QC_INSP', '审核', { 编号: ijNo });
  const ijC = await view('QC_INSP', ijNo);
  const newPi = ijC.data?.detailData?.items?.[0]?.['入库单号'];
  const thList2 = await fetch(BASE + '/px/queryFormDataList', {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'QC_RETURN', pageNo: 1, pageSize: 50, condition: {} }),
  }).then((x) => x.json());
  const liveTh = (thList2.data?.list ?? []).filter((d) => d['单据状态'] !== '已作废');
  chk('11.重审重新生成(新PI号+新TH)', re.code === 200 && newPi && newPi !== piNo && liveTh.length >= 1, '新PI=' + newPi + '(旧' + piNo + ') 存活TH=' + liveTh.map((d) => d['编号']).join(','));

  // ── 清理:弃审IJ(联动作废新一轮)→删IJ→弃审SL→删SL→弃审PO→删PO
  await call('QC_INSP', '弃审', { 编号: ijNo });
  const c1 = await call('QC_INSP', '删除', { 编号: ijNo });
  await call('SL_RECV', '弃审', { 编号: slNo });
  const c2 = await call('SL_RECV', '删除', { 编号: slNo });
  await call('PU_ORDER', '弃审', { 编号: poNo });
  const c3 = await call('PU_ORDER', '删除', { 编号: poNo });
  console.log('清理: IJ', c1.code, 'SL', c2.code, 'PO', c3.code);
  const fails = R.filter((x) => !x.pass);
  console.log('== 总结: ' + (R.length - fails.length) + '/' + R.length + ' PASS' + (fails.length ? ' 未过:' + fails.map((f) => f.name).join(';') : ' 全部通过'));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
