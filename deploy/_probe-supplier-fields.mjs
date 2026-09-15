// 探针:供应商接口字段实测(列表键/详情键/子表键/自定义字段)
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';
const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);

const list = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/supplier', { page: '1', page_size: '3' });
console.log('供应商总数:', list.count);
console.log('\n=== 列表接口键(%d) ===', Object.keys(list.rows?.[0] || {}).length);
console.log(Object.keys(list.rows?.[0] || {}).join(', '));
for (const r of list.rows || []) console.log('  样例:', JSON.stringify(r));

const id = list.rows[0].id;
const d = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/supplier_detail', { id });
console.log('\n=== 详情接口键(%d) ===', Object.keys(d).length);
console.log(Object.keys(d).join(', '));
console.log('\n=== 详情逐键取值(空值也列出,用于判断"接口没给"还是"没有数据") ===');
for (const [k, v] of Object.entries(d)) {
  const shown = v === null ? 'null' : v === '' ? '(空串)' : Array.isArray(v) ? `[数组 ${v.length} 项]` : typeof v === 'object' ? JSON.stringify(v) : String(v).slice(0, 60);
  console.log(`  ${k.padEnd(24)} = ${shown}`);
}
if ((d.account_entity || []).length) console.log('\n=== account_entity 子表键 ===\n' + Object.keys(d.account_entity[0]).join(', '));
if ((d.bom_entity || []).length) console.log('\n=== bom_entity 子表键 ===\n' + Object.keys(d.bom_entity[0]).join(', '));
// 自定义字段(账号里配了自定义字段的话会出现在这里)
console.log('\ncustom_field =', JSON.stringify(d.custom_field));
