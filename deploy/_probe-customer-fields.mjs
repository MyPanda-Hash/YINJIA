// 探针:拉取沙箱「客户」列表行 + 详情 的全部返回字段(与 UI 列名对照用)
// 用法:node _probe-customer-fields.mjs
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
console.log('app-token ok');

const list = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/customer', { page: '1', page_size: '1' });
console.log('客户总数:', list.count);
const row = (list.rows || [])[0] || {};
console.log('\n=== 列表行字段(%d) ===', Object.keys(row).length);
console.log(Object.keys(row).join(', '));

const d = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/customer_detail', { id: row.id });
console.log('\n=== 详情字段(%d) ===', Object.keys(d).length);
console.log(Object.keys(d).join(', '));

console.log('\n=== 详情非空值样例 ===');
for (const [k, v] of Object.entries(d)) {
  if (v === null || v === '' || v === undefined) continue;
  console.log(`  ${k} = ${typeof v === 'object' ? JSON.stringify(v).slice(0, 160) : String(v).slice(0, 80)}`);
}
const cn = d.bomentity || [];
console.log('\n=== 联系人子表(%d 条)字段 ===', cn.length);
if (cn.length) {
  console.log(Object.keys(cn[0]).join(', '));
  console.log(JSON.stringify(cn[0], null, 2).slice(0, 700));
}
