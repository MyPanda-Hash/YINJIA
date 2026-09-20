/**
 * _q-sandbox-inspect.mjs — 只读侦察测试沙箱(359220):有无采购订单/可用物料单位仓库,用于构造合法推送实测
 * 用法: node tools/archive/_q-sandbox-inspect.mjs
 */
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs';

const k = JSON.parse(readFileSync(new URL('../../deploy/push/config.json', import.meta.url), 'utf8'));
const cfg = k.kingdee || k;
const { token } = await fetchAppToken(cfg);
const G = (p, q) => kingdeeGet(cfg, token, p, q);

const po = await G('/jdy/v2/scm/pur_order', { page: '1', page_size: '20' });
console.log(`[沙箱] 采购订单 count=${po.count}`);
const orders = po.rows || [];
for (const r of orders.slice(0, 6)) {
  console.log(`   ${r.bill_no} | ${r.bill_date} | ${r.supplier_name} | 状态=${r.bill_status} | id=${r.id}`);
}
if (orders.length) {
  const d = await G('/jdy/v2/scm/pur_order_detail', { id: orders[0].id });
  console.log(`\n[沙箱] 首张订单 ${d.bill_no} 分录:`);
  for (const e of (d.material_entity || [])) {
    console.log(`   seq=${e.seq} 分录id=${e.id} 商品=${e.material_number}/${e.material_name} 数量=${e.qty} 单位=${e.unit_name} 基本数量=${e.base_qty}`);
  }
}
const ib = await G('/jdy/v2/scm/pur_inbound', { page: '1', page_size: '20' });
console.log(`\n[沙箱] 采购入库 count=${ib.count}`);
if ((ib.rows || []).length) {
  const d = await G('/jdy/v2/scm/pur_inbound_detail', { id: ib.rows[0].id });
  console.log(`   首张 ${d.bill_no} 供应商=${d.supplier_name} 仓库=${d.bill_stock_name} 分录:`);
  for (const e of (d.material_entity || [])) {
    console.log(`   seq=${e.seq} 商品=${e.material_number} 单位=${e.unit_name} 仓库=${e.stock_number} 数量=${e.qty} src_bill_no=${e.src_bill_no || '(空)'} src_seq=${e.src_seq ?? '(空)'}`);
  }
}
const units = await G('/jdy/v2/bd/measure_unit', { page: '1', page_size: '50' });
console.log(`\n[沙箱] 计量单位 count=${units.count} 样例=${(units.rows || []).slice(0, 8).map((x) => x.name).join('/')}`);
const wh = await G('/jdy/v2/bd/store', { page: '1', page_size: '10' });
console.log(`[沙箱] 仓库 count=${wh.count} 样例=${(wh.rows || []).slice(0, 5).map((x) => x.number + ':' + x.name).join(' / ')}`);
