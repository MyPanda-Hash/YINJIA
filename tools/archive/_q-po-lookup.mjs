/**
 * _q-po-lookup.mjs — 只读验证:能否按单号从金蝶取到采购订单 id + 分录 id(推送 src_inter_id/src_entry_id 用)
 * 用法: node tools/archive/_q-po-lookup.mjs YJ-20260916-02
 */
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const k = cfg.kingdee || cfg;
const want = process.argv[2] || 'YJ-20260916-02';
const { token } = await fetchAppToken(k);

const tries = [
  ['bill_no 精确', { page: '1', page_size: '10', bill_no: want }],
  ['单据编号 中文键', { page: '1', page_size: '10', '单据编号': want }],
  ['无过滤首页', { page: '1', page_size: '50' }],
];
for (const [name, params] of tries) {
  try {
    const r = await kingdeeGet(k, token, '/jdy/v2/scm/pur_order', params);
    const rows = r.rows || [];
    const hit = rows.find((x) => String(x.bill_no) === want);
    console.log(`[${name}] count=${r.count} 返回=${rows.length} 命中=${hit ? 'YES id=' + hit.id : 'NO'}`
      + ` 前3单号=${rows.slice(0, 3).map((x) => x.bill_no).join(',')}`);
    if (hit) {
      const d = await kingdeeGet(k, token, '/jdy/v2/scm/pur_order_detail', { id: hit.id });
      console.log(`   详情: 单号=${d.bill_no} id=${d.id} 行数=${(d.material_entity || []).length}`);
      for (const e of (d.material_entity || []).slice(0, 4)) {
        console.log(`      行 seq=${e.seq} id=${e.id} 商品=${e.material_number} 数量=${e.qty} 基本数量=${e.base_qty}`);
      }
      break;
    }
  } catch (e) { console.log(`[${name}] ERR ${e.message.slice(0, 120)}`); }
}
