// 探针:真实账套 生产领料单 关键字段取值分布(设计 MES→金蝶 映射用)
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from './kingdee-client.mjs';
const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const P = '/jdy/v2/scm/inv_pick';
const list = await kingdeeTryGet(cfg.kingdee, token, P, { page: '1', page_size: '30' });
const rows = list.data.rows || [];
const headVals = {}, lineVals = {};
const HEAD_KEYS = ['pick_type', 'bill_type_name', 'bill_type_number', 'mul_bill_label', 'dept_name', 'dept_number', 'emp_name', 'emp_number', 'pick_use_name', 'pick_use_number', 'bill_status'];
const LINE_KEYS = ['src_bill_no', 'src_bill_type_name', 'src_bill_type_number', 'src_bill_type_id', 'src_seq', 'src_bill_date', 'src_product_entry_id', 'stock_name', 'stock_number', 'sp_name', 'sp_number', 'aux_prop_name', 'kf_type', 'kf_period', 'pro_place', 'valid_date', 'kf_date', 'barcode'];
let firstLine = null, firstHead = null;
for (const r of rows.slice(0, 15)) {
  const d = await kingdeeTryGet(cfg.kingdee, token, P + '_detail', { id: r.id });
  if (!d.ok) continue;
  if (!firstHead) firstHead = d.data;
  for (const k of HEAD_KEYS) { const v = d.data[k]; if (v === null || v === '' || v === undefined) continue; (headVals[k] = headVals[k] || new Set()).add(String(v)); }
  for (const l of (d.data.material_entity || [])) {
    if (!firstLine) firstLine = l;
    for (const k of LINE_KEYS) { const v = l[k]; if (v === null || v === '' || v === undefined) continue; (lineVals[k] = lineVals[k] || new Set()).add(String(v)); }
  }
  await new Promise((x) => setTimeout(x, 80));
}
const ser = (o) => Object.fromEntries(Object.entries(o).map(([k, s]) => [k, [...s].slice(0, 8)]));
console.log('头字段取值(去重前 8):'); console.log(JSON.stringify(ser(headVals), null, 2));
console.log('行字段取值(去重前 8):'); console.log(JSON.stringify(ser(lineVals), null, 2));
console.log('\n一行完整样例:'); console.log(JSON.stringify(firstLine, null, 2));
console.log('\n头完整样例(去 material_entity/custom_field):');
const h = { ...firstHead }; delete h.material_entity; delete h.custom_field;
console.log(JSON.stringify(h, null, 2));
writeFileSync(new URL('../tools/archive/_invpick-values.json', import.meta.url), JSON.stringify({ head: ser(headVals), line: ser(lineVals), firstLine, firstHead: h }, null, 2), 'utf8');
