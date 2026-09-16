// 探针:订单行子键 + 联系人子键 全量清单
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';
const cfg = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);

const out = {};
// 订单行子键(取一张有行的单)
for (const [code, path, dpath] of [['SO_ORDER', '/jdy/v2/scm/sal_order', '/jdy/v2/scm/sal_order_detail'], ['PU_ORDER', '/jdy/v2/scm/pur_order', '/jdy/v2/scm/pur_order_detail']]) {
  const l = await kingdeeGet(cfg.kingdee, token, path, { page: '1', page_size: '5', bill_status: 'C' });
  let detail = null;
  for (const r of l.rows || []) {
    const d = await kingdeeGet(cfg.kingdee, token, dpath, { id: r.id });
    if ((d.material_entity || []).length) { detail = d; break; }
  }
  const me = (detail?.material_entity || [])[0] || {};
  out[code] = { lineKeys: Object.keys(me), lineSample: me };
  console.log(`【${code}】行子键 ${Object.keys(me).length} 个: ${Object.keys(me).join(', ')}`);
}
// 客户/供应商联系人子键(已有联系人数据的)
for (const [code, path, dpath, sub] of [['BD_CUSTOMER', '/jdy/v2/bd/customer', '/jdy/v2/bd/customer_detail', 'bomentity'], ['BD_SUPPLIER', '/jdy/v2/bd/supplier', '/jdy/v2/bd/supplier_detail', 'bom_entity']]) {
  const l = await kingdeeGet(cfg.kingdee, token, path, { page: '1', page_size: '10' });
  let found = null;
  for (const r of l.rows || []) {
    const d = await kingdeeGet(cfg.kingdee, token, dpath, { id: r.id });
    if ((d[sub] || []).length) { found = d; break; }
  }
  const ct = (found?.[sub] || [])[0] || {};
  out[code] = { contactKeys: Object.keys(ct), contactSample: ct };
  console.log(`【${code}】联系人子键 ${Object.keys(ct).length} 个: ${Object.keys(ct).join(', ')}`);
  if (code === 'BD_SUPPLIER' && (found?.account_entity || []).length) {
    const acc = found.account_entity[0];
    out[code].accountKeys = Object.keys(acc);
    console.log(`【${code}】银行账户子键 ${Object.keys(acc).length} 个: ${Object.keys(acc).join(', ')}`);
  }
}
writeFileSync(new URL('../tools/archive/_subentity-keys.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
console.log('已写出: ../tools/archive/_subentity-keys.json');
