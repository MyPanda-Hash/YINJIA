// 探针:采购入库(pur_inbound)和销售出库(sal_out_bound)的接口字段全集
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';
const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const out = {};

for (const [code, label, listPath] of [
  ['PUR_IN', '采购入库', '/jdy/v2/scm/pur_inbound'],
  ['SALE_OUT', '销售出库', '/jdy/v2/scm/sal_out_bound'],
]) {
  const l = await kingdeeGet(cfg.kingdee, token, listPath, { page: '1', page_size: '3' });
  const rows = l.rows || [];
  const rec = { label, count: Number(l.count), listKeys: rows[0] ? Object.keys(rows[0]) : [], listFull: rows[0] || null };
  console.log(`【${label}】列表 ${l.count} 条 | 列表键 ${rec.listKeys.length}`);
  // 详情(试 _detail 后缀)
  for (const suffix of ['_detail', '_detail_bill']) {
    const dpath = listPath + suffix;
    try {
      const d = await kingdeeGet(cfg.kingdee, token, dpath, { id: rows[0].id });
      rec.detailPath = dpath;
      rec.detailKeys = Object.keys(d);
      rec.detailFull = d;
      console.log(`  详情(${dpath}) ${rec.detailKeys.length} 键`);
      // 子表键
      for (const [k, v] of Object.entries(d)) {
        if (Array.isArray(v) && v.length) {
          rec[`sub_${k}_keys`] = Object.keys(v[0]);
          console.log(`  子表 ${k}: ${rec[`sub_${k}_keys`].length} 键`);
        }
      }
      break;
    } catch (e) { console.log(`  ${dpath} → ${e.message.slice(0, 60)}`); }
  }
  out[code] = rec;
}
writeFileSync(new URL('../tools/archive/_inbound-outbound-fields.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
console.log('已写出: ../tools/archive/_inbound-outbound-fields.json');
