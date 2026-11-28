// 探针:金蝶「销售出库单」sal_out_bound —— 列表键 + 一条明细的键/批号
// 用法: node deploy/_probe-salout-20261128.mjs [--days=60]
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const { token, domain } = await fetchAppToken(cfg.kingdee);
const cfg2 = { ...cfg.kingdee, domain };
const days = Number((process.argv.find((a) => a.startsWith('--days=')) || '--days=180').split('=')[1]);

const now = Date.now();
const listParams = {
  bill_status: 'C',
  page: '1',
  page_size: '5',
  modify_start_time: String(now - days * 86400000),
  modify_end_time: String(now + 60 * 60000),
};
const data = await kingdeeGet(cfg2, token, '/jdy/v2/scm/sal_out_bound', listParams);
const rows = data?.rows || [];
console.log('== 列表 total:', data?.count ?? data?.total, ' total_page:', data?.total_page, ' 返回:', rows.length);
if (rows[0]) console.log('== 列表键:', Object.keys(rows[0]).join(','));
for (const r of rows) console.log(`  · ${r.bill_no} | ${r.bill_date} | ${r.customer_name} | ${r.bill_status} | io=${r.io_status}`);

if (rows[0]) {
  const det = await kingdeeGet(cfg2, token, '/jdy/v2/scm/sal_out_bound_detail', { id: rows[0].id });
  const bill = Array.isArray(det) ? det[0] : (det?.rows?.[0] || det);
  const me = bill?.material_entity || [];
  console.log(`\n== 详情 ${bill?.bill_no} 头键数=${bill ? Object.keys(bill).length : 0} 分录数=${me.length}`);
  if (me[0]) {
    console.log('== 分录键:', Object.keys(me[0]).join(','));
    for (const m of me.slice(0, 8)) {
      console.log(`  · seq=${m.seq} ${m.material_number} ${m.material_name} 数量=${m.qty} 批号=[${m.batch_no ?? ''}] 源单=${m.src_bill_no ?? ''}/${m.src_seq ?? ''}`);
    }
  }
}
