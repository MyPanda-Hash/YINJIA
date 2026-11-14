// 只读取证(真实账套):两张采购订单的分录状态 + 商品检验标志。
// 运行: node tools/archive/_erp-0038-20261111/_q-orders.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(here, '../../../deploy/config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
const { token, domain } = await fetchAppToken(cfg);
cfg.domain = domain;
console.log('账套 clientId=', cfg.clientId, 'outerInstanceId=', cfg.outerInstanceId);

const ORDERS = (process.argv.slice(2).length ? process.argv.slice(2) : ['YJ-20261103-07', 'YJ-20261102-02']);

for (const po of ORDERS) {
  const list = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { page: '1', page_size: '10', bill_no: po });
  const hit = (list.rows || []).find((r) => r.bill_no === po);
  console.log('\n########## ' + po + ' ##########');
  if (!hit) { console.log('订单不存在'); continue; }
  const d = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order_detail', { id: String(hit.id) });
  console.log('头: bill_status=' + d.bill_status + ' io_status=' + d.io_status + ' bill_close_state=' + d.bill_close_state
    + ' 供应商=' + d.supplier_name + '(' + d.supplier_number + ') 日期=' + d.bill_date);
  const keys = ['seq', 'material_number', 'material_name', 'unit_name', 'qty', 'in_qty', 'un_out_qty', 'close_state', 'entry_realio_status', 'comment'];
  console.log(keys.join(' | '));
  for (const e of (d.material_entity || [])) console.log(keys.map((k) => (e[k] === undefined || e[k] === null ? '' : e[k])).join(' | '));
}

// 商品检验标志:按列表翻页找 number 命中
const MATS = ['YJ-YCYX-020', 'YJ-HKB-001'];
const found = {};
for (let page = 1; page <= 20 && Object.keys(found).length < MATS.length; page++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/material', { page: String(page), page_size: '300' });
  if (!r.ok) { console.log('material 列表失败: ' + r.error); break; }
  const rs = (r.data && r.data.rows) || [];
  if (!rs.length) break;
  for (const m of rs) if (MATS.includes(m.number)) found[m.number] = m;
  if (rs.length < 300) break;
}
console.log('\n=== 商品档案检验相关键 ===');
for (const no of MATS) {
  const m = found[no];
  if (!m) { console.log(no + ' 未在商品档案前 6000 条中命中'); continue; }
  const d2 = await kingdeeGet(cfg, token, '/jdy/v2/bd/material_detail', { id: String(m.id) });
  const qcKeys = Object.keys(d2).filter((k) => /qc|insp|check|quality|test|verify/i.test(k));
  console.log(no + ' (' + d2.name + '): ' + qcKeys.map((k) => k + '=' + JSON.stringify(d2[k])).join(' | '));
  console.log('  custom_field=' + JSON.stringify(d2.custom_field));
}
