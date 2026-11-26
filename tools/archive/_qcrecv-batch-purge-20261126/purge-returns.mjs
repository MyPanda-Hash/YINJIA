// 最后 3 条"造数链"清理：暂收退回单(已审核，ERP单号是造数时自编的) → 检验单 → 送料暂收单
// 顺序必须是：先弃审退回单(它挡着检验单弃审) → 再弃审暂收单(级联弃审检验单，并把退回单草稿作废) → 再逐个删除
import { login, post, queryPanel } from './api.mjs';

const TRIOS = [
  { th: 'TH-2026-10-0003', ij: 'IJ-2026-10-0205', sl: 'SL-2026-10-0121', erp: 'CGTH-20260915-00001' },
  { th: 'TH-2026-10-0005', ij: 'IJ-2026-10-0207', sl: 'SL-2026-10-0125', erp: 'CGTH-20260921-00002' },
  { th: 'TH-2026-10-0006', ij: 'IJ-2026-10-0208', sl: 'SL-2026-10-0127', erp: 'CGTH-20260927-00003' },
];

const log = (...a) => console.log(...a);

async function st(panel, no) {
  const d = await queryPanel(panel, { keyword: no, pageSize: 20 });
  const row = (d.list || []).find((x) => [x['编号'], x['单号'], x['单据编号']].includes(no));
  return row ? row['单据状态'] : '不在列表';
}
async function btn(panel, name, no) {
  const r = await post('/px/callButton', { panelCode: panel, buttonName: name, formData: { 编号: no }, buttonParam: {} });
  if (r.body.code !== 200) throw new Error(`${panel} ${name} ${no}: ${r.body.message}`);
  return r.body.data;
}
async function del(panel, no) {
  const r = await post('/px/deleteForms', { panelCode: panel, rowCodes: [no] });
  if (r.body.code !== 200) throw new Error(`${panel} 删除 ${no}: ${r.body.message}`);
}

await login();
for (const t of TRIOS) {
  log(`\n=== ${t.sl} / ${t.ij} / ${t.th}  (原ERP单号 ${t.erp})`);
  for (const [panel, no] of [['QC_RETURN', t.th], ['QC_INSP', t.ij], ['QC_RECV', t.sl]]) log(`  起始状态 ${panel} ${no} = ${await st(panel, no)}`);
  try {
    if (await st('QC_RETURN', t.th) === '已审核') { await btn('QC_RETURN', '弃审', t.th); log(`  弃审退回单 OK → ${await st('QC_RETURN', t.th)}`); }
    if (await st('QC_RECV', t.sl) === '已审核') { await btn('QC_RECV', '弃审', t.sl); log(`  弃审暂收单 OK → ${await st('QC_RECV', t.sl)}（级联处理检验单/退回单）`); }
    log(`  检验单状态 = ${await st('QC_INSP', t.ij)}  退回单状态 = ${await st('QC_RETURN', t.th)}`);
    if (await st('QC_INSP', t.ij) !== '不在列表') { await del('QC_INSP', t.ij); log(`  删除检验单 OK → ${await st('QC_INSP', t.ij)}`); }
    if (await st('QC_RETURN', t.th) !== '不在列表') { await del('QC_RETURN', t.th); log(`  删除退回单 OK → ${await st('QC_RETURN', t.th)}`); }
    if (await st('QC_RECV', t.sl) !== '不在列表') { await del('QC_RECV', t.sl); log(`  删除暂收单 OK → ${await st('QC_RECV', t.sl)}`); }
  } catch (e) {
    log(`  ✗ 失败: ${e.message}`);
  }
}
