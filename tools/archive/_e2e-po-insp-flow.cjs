// _e2e-po-insp-flow.cjs — 采购→品检分流全链 E2E(2026-09-16):
// ①PO草稿→生送料暂收单 应被拒(仅已审核可生单)
// ②PO审核→生成送料暂收单 OK(品检路径)
// ③SL草稿→生成来料检验单 应被拒
// ④SL审核→生成来料检验单 OK
// ⑤SL弃审→改数量→保存→IJ 同步(核心)
// ⑥PO再直接生成采购入库单 OK(免检路径)
// 清理:IJ删→SL删→PI删→PO删(全走 API,自动释放占用)
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
  const chk = (name, pass, detail) => { R.push({ name, pass, detail }); console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : '')); };

  // ① 建草稿 PO,先试生单(应拒)
  const po = await call('PU_ORDER', '保存', {
    单据日期: '2026-09-16', 供应商: '流程验证供应商',
    detail: { items: [
      { 物料编码: 'CL005', 物料名称: '包装木箱', 规格型号: '1200x800', 数量: 60, 单价: 5, 金额: 300 },
      { 物料编码: 'CL005', 物料名称: '包装木箱', 规格型号: '1200x800', 数量: 40, 单价: 5, 金额: 200 },
    ] },
  });
  const poNo = po.data?.['编号'];
  chk('0.建草稿PO', !!poNo, poNo ?? JSON.stringify(po).slice(0, 200));

  const gen1 = await call('PU_ORDER', '生成送料暂收单', { 编号: poNo });
  chk('1.草稿PO生送料暂收单被拒', gen1.code !== 200 && String(gen1.message).includes('已审核'), String(gen1.message).slice(0, 80));

  // ② 审核 PO → 生成送料暂收单
  await call('PU_ORDER', '审核', { 编号: poNo });
  const gen2 = await call('PU_ORDER', '生成送料暂收单', { 编号: poNo });
  const slNo = gen2.data?.['编号'];
  chk('2.已审核PO生成送料暂收单', gen2.code === 200 && !!slNo, slNo + ' goto=' + gen2.data?.gotoPanel);
  const slv = await view('SL_RECV', slNo);
  const slItems = slv.data?.detailData?.items ?? [];
  chk('2b.SL带入(两行+型号)', slItems.length === 2 && slItems.every((x) => x['型号'] === '1200x800'), JSON.stringify(slItems.map((x) => x['数量'])));

  // ③ SL 草稿 → 生成来料检验单(应拒)
  const gen3 = await call('SL_RECV', '生成来料检验单', { 编号: slNo });
  chk('3.草稿SL生成来料检验单被拒', gen3.code !== 200 && String(gen3.message).includes('已审核'), String(gen3.message).slice(0, 80));

  // ④ SL 审核 → 生成来料检验单
  await call('SL_RECV', '审核', { 编号: slNo });
  const gen4 = await call('SL_RECV', '生成来料检验单', { 编号: slNo });
  const ijNo = gen4.data?.['编号'];
  chk('4.已审核SL生成来料检验单', gen4.code === 200 && !!ijNo, ijNo);
  const ijv = await view('QC_INSP', ijNo);
  const ijItems = ijv.data?.detailData?.items ?? [];
  chk('4b.IJ镜像两行', ijItems.length === 2, JSON.stringify(ijItems.map((x) => x['数量'])));

  // ⑤ SL 弃审 → 行1数量 60→33 + 备注变化 + 行2删除 → 保存 → IJ 应同步
  await call('SL_RECV', '弃审', { 编号: slNo });
  const slv2 = await view('SL_RECV', slNo);
  const items = (slv2.data?.detailData?.items ?? []).map((x) => ({ ...x }));
  const kept = items.filter((x) => Number(x['数量']) !== 40);
  kept[0]['数量'] = 33;
  kept[0]['备注'] = '退审修改同步验证';
  const save = await call('SL_RECV', '保存', {
    编号: slNo, 单号: slNo, 日期: (slv2.data?.data ?? {})['日期'], 供应商: (slv2.data?.data ?? {})['供应商'],
    detail: { items: kept },
  });
  chk('5.退审修改保存', save.code === 200, JSON.stringify(save.data ?? save).slice(0, 80));
  const ijv2 = await view('QC_INSP', ijNo);
  const ij2 = ijv2.data?.detailData?.items ?? [];
  const okQty = ij2.length === 1 && Number(ij2[0]['数量']) === 33 && ij2[0]['备注'] === '退审修改同步验证';
  chk('5b.退审修改同步到IJ(33/备注/删行)', okQty, JSON.stringify(ij2.map((x) => ({ q: x['数量'], m: x['备注'] }))));

  // ⑥ 同一已审核 PO 直接生成采购入库单(免检路径)
  const gen6 = await call('PU_ORDER', '生成采购入库单', { 编号: poNo });
  const piNo = gen6.data?.['编号'];
  chk('6.已审核PO直接生成采购入库单', gen6.code === 200 && !!piNo, piNo ?? String(gen6.message).slice(0, 80));

  // 清理(全 API): IJ删 → SL删 → PI删 → PO删(删除自动释放 form_flow_link)
  const c1 = await call('QC_INSP', '删除', { 编号: ijNo });
  await call('SL_RECV', '弃审', { 编号: slNo }).catch(() => {});
  const c2 = await call('SL_RECV', '删除', { 编号: slNo });
  const c3 = await call('PURCHASE_IN', '删除', { 编号: piNo });
  await call('PU_ORDER', '弃审', { 编号: poNo }).catch(() => {});
  const c4 = await call('PU_ORDER', '删除', { 编号: poNo });
  console.log('清理: IJ', c1.code, 'SL', c2.code, 'PI', c3.code, 'PO', c4.code);

  const fails = R.filter((x) => !x.pass);
  console.log('== 总结: ' + (R.length - fails.length) + '/' + R.length + ' PASS' + (fails.length ? ' 未过:' + fails.map((f) => f.name).join(';') : ' 全部通过'));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
