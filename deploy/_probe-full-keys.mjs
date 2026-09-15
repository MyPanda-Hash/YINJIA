// 探针:完整可同步键集核查
//   ① 每个档案 列表键 ∪ 详情键 → 找出"我当前只用详情而漏掉的列表独有字段"
//   ② 补充接口(material_brand 等)能否解析 id→名称
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';
const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);

const T = [
  ['结算方式', '/jdy/v2/bd/settlement_type', null],
  ['客户分类', '/jdy/v2/bd/customer_group', null],
  ['供应商分类', '/jdy/v2/bd/supplier_group', null],
  ['商品分类', '/jdy/v2/bd/material_group', null],
  ['币别', '/jdy/v2/bd/currency', '/jdy/v2/bd/currency_detail'],
  ['计量单位', '/jdy/v2/bd/measure_unit', '/jdy/v2/bd/measure_unit_detail'],
  ['部门', '/jdy/v2/bd/department', '/jdy/v2/bd/department_detail'],
  ['职员', '/jdy/v2/bd/emp', '/jdy/v2/bd/emp_detail'],
  ['仓库', '/jdy/v2/bd/store', '/jdy/v2/bd/store_detail'],
  ['商品', '/jdy/v2/bd/material', '/jdy/v2/bd/material_detail'],
  ['客户', '/jdy/v2/bd/customer', '/jdy/v2/bd/customer_detail'],
  ['供应商', '/jdy/v2/bd/supplier', '/jdy/v2/bd/supplier_detail'],
];
console.log('══ ① 列表 ∪ 详情:详情拿不到的"列表独有"字段(当前实现会漏) ══');
for (const [label, listPath, detailPath] of T) {
  const l = await kingdeeGet(cfg.kingdee, token, listPath, { page: '1', page_size: '1' });
  const lk = new Set(Object.keys((l.rows || [])[0] || {}));
  if (!detailPath) { console.log(`【${label}】仅列表,${lk.size} 键: ${[...lk].join(', ')}`); continue; }
  const d = await kingdeeGet(cfg.kingdee, token, detailPath, { id: (l.rows || [])[0].id });
  const dk = new Set(Object.keys(d));
  const onlyList = [...lk].filter((k) => !dk.has(k));
  const onlyDetail = [...dk].filter((k) => !lk.has(k));
  const both = [...lk].filter((k) => dk.has(k));
  console.log(`【${label}】列表 ${lk.size} / 详情 ${dk.size} / 并集 ${new Set([...lk, ...dk]).size}`);
  if (onlyList.length) console.log(`   ⚠仅列表有(详情拿不到): ${onlyList.join(', ')}`);
  if (onlyDetail.length) console.log(`   仅详情有: ${onlyDetail.length} 个`);
  void both;
}
console.log('\n══ ② 补充接口:品牌(商品品牌 id→名称) ══');
const b = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/material_brand', { page: '1', page_size: '3' });
console.log('品牌数:', b.count, '| 键:', Object.keys((b.rows || [])[0] || {}).join(', '));
console.log('样例:', JSON.stringify((b.rows || []).slice(0, 3)));
console.log('\n══ ③ BOM 接口(物料清单,可选同步) ══');
try {
  const bom = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/bd/bom', { page: '1', page_size: '1' });
  console.log('BOM 数:', bom.count, '| 键:', Object.keys((bom.rows || [])[0] || {}).join(', '));
} catch (e) { console.log('BOM 接口:', e.message.slice(0, 100)); }
