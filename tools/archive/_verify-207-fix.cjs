// _verify-207-fix.cjs — 修复验证:带 数据来源 的明细保存 200;删除复现草稿;SL_RECV 链路回归
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };
  const call = (panel, btn, formData) => fetch(BASE + '/px/callButton', {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: panel, buttonName: btn, formData }),
  }).then((x) => x.json());

  // 1) 复现用例再跑:期望 200
  const r = await call('PU_ORDER', '保存', {
    单据日期: '2026-09-15', 供应商: '北方机械',
    detail: { items: [{ 物料编码: 'CL005', 物料名称: '包装木箱', 规格型号: '1200×800', 数量: 5, 单价: 5, 数据来源: '采购' }] },
  });
  console.log('1) 带数据来源保存 ->', r.code, r.code === 200 ? 'PASS ' + JSON.stringify(r.data) : String(r.message).slice(0, 300));
  const poNo = r.data?.['编号'];

  // 2) 头表 数据来源 正常写入不受影响(经头字段显式提交)
  const fd = await fetch(BASE + '/px/getFormDescriptor?panelCode=PU_ORDER&code=' + encodeURIComponent(poNo), { headers: H }).then((x) => x.json());
  console.log('2) 单据读回 ->', fd.code, '行数:', fd.data?.detailData?.items?.length, '头数据来源:', (fd.data?.data ?? {})['数据来源'] ?? '(未提交,空)');

  // 3) 删除复现草稿
  const del = await call('PU_ORDER', '删除', { 编号: poNo });
  console.log('3) 删除复现草稿', poNo, '->', del.code, del.code === 200 ? 'PASS' : String(del.message).slice(0, 200));

  // 4) 回归:SL_RECV 弃审→原样保存→同步钩子仍工作(IJ 明细保持 1 行 20)
  await call('SL_RECV', '弃审', { 编号: 'SL-2026-09-0001' });
  const sl = await fetch(BASE + '/px/getFormDescriptor?panelCode=SL_RECV&code=SL-2026-09-0001', { headers: H }).then((x) => x.json());
  const items = sl.data?.detailData?.items ?? [];
  const save = await call('SL_RECV', '保存', {
    编号: 'SL-2026-09-0001', 单号: 'SL-2026-09-0001',
    日期: (sl.data?.data ?? {})['日期'], 供应商: (sl.data?.data ?? {})['供应商'],
    detail: { items: items.map((x) => ({ ...x })) },
  });
  console.log('4) SL回归保存 ->', save.code, save.code === 200 ? 'PASS' : String(save.message).slice(0, 300));
  const ij = await fetch(BASE + '/px/getFormDescriptor?panelCode=QC_INSP&code=IJ-2026-09-0006', { headers: H }).then((x) => x.json());
  const ijItems = ij.data?.detailData?.items ?? [];
  console.log('   IJ同步回归 ->', ijItems.length === 1 && Number(ijItems[0]['数量']) === 20 ? 'PASS(1行,数量20)' : 'FAIL ' + JSON.stringify(ijItems));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
