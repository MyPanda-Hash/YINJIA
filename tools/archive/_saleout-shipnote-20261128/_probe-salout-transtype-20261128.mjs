// 探针:金蝶 sal_out_bound 的 trans_type 分布 + 数量正负(判断 出库类别 映射)
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const { token, domain } = await fetchAppToken(cfg.kingdee);
const cfg2 = { ...cfg.kingdee, domain };
const now = Date.now();
const stat = new Map();
for (let page = 1; page <= 5; page++) {
  const d = await kingdeeGet(cfg2, token, '/jdy/v2/scm/sal_out_bound', {
    bill_status: 'C', page: String(page), page_size: '100',
    modify_start_time: String(now - 120 * 86400000), modify_end_time: String(now + 60 * 60000),
  });
  for (const r of d.rows || []) {
    const k = String(r.trans_type);
    const s = stat.get(k) || { n: 0, neg: 0, sample: null };
    const q = Number(r.material_qty || 0);
    s.n++; if (q < 0) s.neg++;
    s.sample = s.sample || `${r.bill_no}(${r.customer_name}) qty=${r.material_qty} amount=${r.total_amount}`;
    stat.set(k, s);
  }
  if (Number(d.total_page || 1) <= page) break;
}
for (const [k, v] of [...stat].sort((a, b) => b[1].n - a[1].n)) console.log(`trans_type=${k}  张数=${v.n}  负数张数=${v.neg}  例:${v.sample}`);
