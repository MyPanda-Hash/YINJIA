// 探针:金蝶「销售出库单」详情 —— 头键/值 + 行键/值(用于设计映射)
// 用法: node deploy/_probe-salout-keys-20261128.mjs [bill_no]
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const { token, domain } = await fetchAppToken(cfg.kingdee);
const cfg2 = { ...cfg.kingdee, domain };
const want = process.argv[2] || '';

const now = Date.now();
const list = await kingdeeGet(cfg2, token, '/jdy/v2/scm/sal_out_bound', {
  bill_status: 'C', page: '1', page_size: '200',
  modify_start_time: String(now - 30 * 86400000), modify_end_time: String(now + 60 * 60000),
});
const rows = list.rows || [];
// 找一张明细行多的单
let pick = rows.find((r) => String(r.bill_no) === want);
if (!pick) {
  let best = null;
  for (const r of rows.slice(0, 12)) {
    const d = await kingdeeGet(cfg2, token, '/jdy/v2/scm/sal_out_bound_detail', { id: r.id });
    const bill = Array.isArray(d) ? d[0] : (d?.rows?.[0] || d);
    const n = (bill?.material_entity || []).length;
    if (!best || n > best.n) best = { n, bill };
    if (n >= 4) break;
  }
  pick = best ? best.bill : null;
} else {
  const d = await kingdeeGet(cfg2, token, '/jdy/v2/scm/sal_out_bound_detail', { id: pick.id });
  pick = Array.isArray(d) ? d[0] : (d?.rows?.[0] || d);
}
if (!pick) { console.log('没有可用的单据'); process.exit(0); }

const shown = (o, except = []) => Object.entries(o || {})
  .filter(([k]) => !except.includes(k))
  .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
  .map(([k, v]) => `  ${k} = ${JSON.stringify(v).slice(0, 160)}`);

console.log(`== 单据 ${pick.bill_no}  头键 ${Object.keys(pick).length}`);
console.log(shown(pick, ['material_entity', 'express_entity', 'custom_field']).join('\n'));
console.log(`\n== 分录 ${(pick.material_entity || []).length} 行;第 1 行有值的键:`);
const m0 = (pick.material_entity || [])[0] || {};
console.log(shown(m0).join('\n'));
console.log('\n== 各行业务列摘要:');
for (const m of pick.material_entity || []) {
  console.log(`  seq=${m.seq} 物料=${m.material_number}/${m.material_name} 型号=${m.material_model} 单位=${m.unit_name} 数量=${m.qty} 批号=${JSON.stringify(m.batch_no)} 仓库=${m.stock_name} 售价=${m.price} 金额=${m.amount} 税率=${m.cess} 源单=${m.src_bill_no}/${m.src_seq} 备注=${JSON.stringify(m.comment)} 客户单号=${JSON.stringify(m.cus_bill_no)}`);
}
