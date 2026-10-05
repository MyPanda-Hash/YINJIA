// 探针:真实账套里「材料出库 / 生产领料」到底用哪张单、有没有数据、接口全字段
// 用法: node deploy/_probe-matout.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from './kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
console.log('账套:', cfg.kingdee.outerInstanceId ? '真实账套(动态授权)' : '沙箱(静态密钥)');

// 候选路径:材料出库/生产领料/其他出库/领料退料 各家写法
const CANDS = [
  ['生产领料单', '/jdy/v2/scm/inv_pick'],
  ['生产领料单', '/jdy/v2/pm/inv_pick'],
  ['生产领料单', '/jdy/v2/pm/pick_material'],
  ['生产领料单', '/jdy/v2/scm/pick_material'],
  ['生产领料单', '/jdy/v2/pm/prod_pick'],
  ['生产领料单', '/jdy/v2/scm/prod_pick'],
  ['生产领料单', '/jdy/v2/pm/production_pick'],
  ['材料出库单', '/jdy/v2/scm/material_out'],
  ['材料出库单', '/jdy/v2/scm/inv_material_out'],
  ['材料出库单', '/jdy/v2/pm/material_out'],
  ['其他出库单', '/jdy/v2/scm/inv_other_out'],
  ['其他出库单', '/jdy/v2/scm/other_out'],
  ['出库单', '/jdy/v2/scm/inv_out'],
  ['领料退料', '/jdy/v2/pm/pick_return'],
  ['生产退料', '/jdy/v2/pm/prod_return'],
  // 对照组(已知可用)
  ['对照:采购入库', '/jdy/v2/scm/pur_inbound'],
  ['对照:销售出库', '/jdy/v2/scm/sal_out_bound'],
  ['对照:产品入库', '/jdy/v2/pm/prod_inbound'],
  ['对照:生产任务', '/jdy/v2/pm/prod_task'],
];
const found = [];
for (const [label, path] of CANDS) {
  const r = await kingdeeTryGet(cfg.kingdee, token, path, { page: '1', page_size: '2' });
  if (r.ok) {
    const n = Number(r.data?.count ?? (Array.isArray(r.data?.rows) ? r.data.rows.length : 0));
    console.log(`✅ ${label} ${path} → count=${r.data?.count} rows=${(r.data?.rows || []).length}`);
    found.push({ label, path, count: r.data?.count, sample: (r.data?.rows || [])[0] || null });
  } else {
    console.log(`❌ ${label} ${path} → ${r.error}`);
  }
  await new Promise((r) => setTimeout(r, 120));
}
writeFileSync(new URL('../tools/archive/_matout-probe.json', import.meta.url), JSON.stringify(found, null, 2), 'utf8');
console.log('\n已写出 tools/archive/_matout-probe.json;命中', found.length, '个');
