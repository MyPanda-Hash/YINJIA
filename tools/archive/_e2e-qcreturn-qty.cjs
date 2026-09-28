// _e2e-qcreturn-qty.cjs — 暂收退料单数量回归 E2E(2026-09-30 修复验证):
// 直接造一张带不良数量的来料检验单 → 审核 → 校验自动生成的暂收退料单:
//   行数量=不良数量(本次修复点,此前写死「退货数量」标签被静默丢弃)、头检验单号=来源IJ(溯源列,本次补)、
//   顺带回归 PI 实收=合格数量;结束后清理(弃审联动作废 + 删除)。
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  if (!login.data?.token) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 120));
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };
  const call = (panelCode, buttonName, formData) =>
    fetch(BASE + '/px/callButton', { method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData }) }).then((x) => x.json());
  const view = (panel, no) =>
    fetch(BASE + '/px/getFormDescriptor?panelCode=' + panel + '&code=' + encodeURIComponent(no), { headers: H }).then((x) => x.json());
  const list = (panel) =>
    fetch(BASE + '/px/queryFormDataList', { method: 'POST', headers: H,
      body: JSON.stringify({ panelCode: panel, pageNo: 1, pageSize: 30, condition: {} }) }).then((x) => x.json());
  const R = [];
  const chk = (name, pass, detail) => { R.push({ name, pass }); console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : '')); };
  const today = new Date().toISOString().slice(0, 10);

  // 1. 直接造检验单草稿(单行 数量100/合格70/不良30)
  const mk = await call('QC_INSP', '保存', {
    单据日期: today, 供应商: '数量回归验证供应商', 供应商代码: 'E2E-QTY',
    detail: { items: [
      { 物料编码: 'CL005', 物料名称: '包装木箱', 规格型号: '1200x800', 数量: 100, 合格数量: 70, 不良数量: 30, 备注: 'E2E-qty-20260930' },
    ] },
  });
  const ijNo = mk.data?.['编号'];
  chk('1.检验单草稿保存', !!ijNo, ijNo + ' | ' + JSON.stringify(mk.data ?? mk).slice(0, 60));

  // 2. 审核 → 双出口自动生单
  const aud = await call('QC_INSP', '审核', { 编号: ijNo });
  chk('2.审核', aud.code === 200 && aud.data?.['单据状态'] === '已审核', JSON.stringify(aud.data ?? aud).slice(0, 60));

  // 3. 找自动生成的 TH(备注标记定位,取最新)
  const thList = await list('QC_RETURN');
  const thDocs = (thList.data?.list ?? []).filter((d) => (d['编号'] || '').startsWith('TH-'));
  const thNo = thDocs.map((d) => d['编号']).sort().pop();
  const thv = await view('QC_RETURN', thNo);
  const thRows = thv.data?.detailData?.items ?? [];
  const thHead = thv.data?.data ?? {};
  chk('3.TH生成且仅1行(不良行)', thRows.length === 1, thNo + ' 行数=' + thRows.length);
  chk('4.★TH行数量=不良数量30(本次修复点)', Number(thRows[0]?.['数量']) === 30, '数量=' + thRows[0]?.['数量']);
  chk('5.★TH头检验单号=来源IJ(溯源列)', thHead['检验单号'] === ijNo, '检验单号=' + thHead['检验单号'] + ' 期望=' + ijNo);
  chk('6.TH数据带入(物料/型号/供应商)', thRows[0]?.['物料编码'] === 'CL005' && thRows[0]?.['规格型号'] === '1200x800' && thHead['供应商'] === '数量回归验证供应商',
    '物料=' + thRows[0]?.['物料编码'] + ' 供应商=' + thHead['供应商']);

  // 4. 回归:PI 实收=合格70
  const ijA = await view('QC_INSP', ijNo);
  const piNo = (ijA.data?.detailData?.items ?? [])[0]?.['入库单号'];
  if (piNo) {
    const piv = await view('PURCHASE_IN', piNo);
    const piRows = piv.data?.detailData?.items ?? [];
    chk('7.回归:PI实收=合格70', piRows.length === 1 && Number(piRows[0]['实收数量']) === 70, piNo + ' 实收=' + (piRows[0]?.['实收数量'] ?? '空'));
  } else {
    chk('7.回归:PI生成', false, '未回填入库单号');
  }

  // 5. 清理:弃审 IJ(联动 void PI/TH 草稿)→ 三单删除
  const un = await call('QC_INSP', '弃审', { 编号: ijNo });
  chk('8.弃审联动', un.code === 200, JSON.stringify(un.data ?? un).slice(0, 60));
  for (const [pc, no] of [['QC_INSP', ijNo], ['PURCHASE_IN', piNo], ['QC_RETURN', thNo]]) {
    if (!no) continue;
    const del = await call(pc, '删除', { 编号: no });
    console.log('清理 ' + pc + ' ' + no + ' → ' + (del.code === 200 ? 'OK' : JSON.stringify(del).slice(0, 60)));
  }
  const fails = R.filter((x) => !x.pass).length;
  console.log(fails === 0 ? '== 全部通过 ==' : '== 有 ' + fails + ' 项失败 ==');
  process.exit(fails === 0 ? 0 : 1);
}
main().catch((e) => { console.error('E2E ERROR', e.message); process.exit(2); });
