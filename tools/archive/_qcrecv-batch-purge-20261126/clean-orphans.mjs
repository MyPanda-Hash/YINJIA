// 收尾：清掉"单据没了、引用还在"的占位 ——
//   ① 10 张检验数据记录（JYSJ-2026-10-0089~0098，审核时间同样 12:00:00，属同批造数）
//   ② 10 行待检验目录（qc_catalog_detail，指向已删检验单/记录单）
import { readFileSync } from 'node:fs';
import { login, post, queryPanel } from './api.mjs';

const JYSJ = ['JYSJ-2026-10-0089','JYSJ-2026-10-0090','JYSJ-2026-10-0091','JYSJ-2026-10-0092','JYSJ-2026-10-0093',
  'JYSJ-2026-10-0094','JYSJ-2026-10-0095','JYSJ-2026-10-0096','JYSJ-2026-10-0097','JYSJ-2026-10-0098'];
const rows = JSON.parse(readFileSync('catalog-rows.json', 'utf8'));

async function st(panel, no) {
  const d = await queryPanel(panel, { keyword: no, pageSize: 20 });
  const r = (d.list || []).find((x) => [x['编号'], x['单号'], x['单据编号']].includes(no));
  return r ? r['单据状态'] : '不在列表';
}
async function btn(panel, name, no) {
  const r = await post('/px/callButton', { panelCode: panel, buttonName: name, formData: { 编号: no }, buttonParam: {} });
  if (r.body.code !== 200) throw new Error(`${panel} ${name} ${no}: ${r.body.message}`);
}
async function del(panel, no) {
  const r = await post('/px/deleteForms', { panelCode: panel, rowCodes: [no] });
  if (r.body.code !== 200) throw new Error(`${panel} 删除 ${no}: ${r.body.message}`);
}

await login();
console.log('=== ① 检验数据记录 ===');
for (const no of JYSJ) {
  const s0 = await st('QC_INSP_REC', no);
  if (s0 === '不在列表') { console.log(`  ${no} 已不在列表`); continue; }
  try {
    if (s0 === '已审核') { await btn('QC_INSP_REC', '弃审', no); console.log(`  ${no} 弃审 OK → ${await st('QC_INSP_REC', no)}`); }
    await del('QC_INSP_REC', no);
    console.log(`  ${no} 删除 OK → ${await st('QC_INSP_REC', no)}`);
  } catch (e) { console.log(`  ✗ ${no}: ${e.message}`); }
}

console.log('\n=== ② 待检验目录行 ===');
for (const r of rows) {
  try {
    const res = await post('/px/callButton', {
      panelCode: 'QC_CATALOG', buttonName: '删除记录',
      formData: { 编号: r.目录单, id: r.id }, buttonParam: {},
    });
    console.log(res.body.code === 200
      ? `  id=${r.id} ${r.检验单} ${r.物料}/${r.批次} 删除 OK`
      : `  ✗ id=${r.id}: ${res.body.message}`);
  } catch (e) { console.log(`  ✗ id=${r.id}: ${e.message}`); }
}
