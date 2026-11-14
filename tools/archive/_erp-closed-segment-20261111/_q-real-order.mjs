// 只读取证(真实账套 359797):订单 YJ-20261103-01 的分录关闭状态 + 该订单挂过的采购入库单
// 只发 GET。运行: node tools/archive/_erp-closed-segment-20261111/_q-real-order.mjs [订单号]
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const rawCfg = readFileSync(resolve(here, '../../../deploy/config.json'), 'utf8').replace(/^\uFEFF/, '');
const cfg = JSON.parse(rawCfg).kingdee;
console.log('账套 clientId=', cfg.clientId, ' outerInstanceId=', cfg.outerInstanceId);
const { token, domain } = await fetchAppToken(cfg);
cfg.domain = domain;
console.log('token ok, domain=', domain);

const PO = process.argv[2] || 'YJ-20261103-01';

const list = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { page: '1', page_size: '10', bill_no: PO });
const rows = list.rows || [];
console.log('\n=== pur_order 列表命中 ' + rows.length + ' 条 ===');
for (const r of rows) {
  console.log(JSON.stringify({
    id: r.id, bill_no: r.bill_no, bill_date: r.bill_date,
    bill_status: r.bill_status, io_status: r.io_status, bill_close_state: r.bill_close_state,
  }, null, 0));
}
const hit = rows.find((r) => r.bill_no === PO);
if (!hit) { console.log('列表未命中'); process.exit(0); }

const detail = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order_detail', { id: String(hit.id) });
const ents = detail.material_entity || [];
console.log('\n=== 订单头 ===');
console.log(JSON.stringify({
  bill_no: detail.bill_no, bill_date: detail.bill_date, bill_status: detail.bill_status,
  io_status: detail.io_status, bill_close_state: detail.bill_close_state,
  close_state: detail.close_state, supplier_name: detail.supplier_name,
}, null, 1));

console.log('\n=== 分录关键状态(close_state 0已关闭/1未关闭/2手动关闭) ===');
const keys = ['seq', 'material_number', 'material_name', 'unit_name', 'qty', 'base_qty',
  'in_qty', 'un_out_qty', 'close_state', 'io_status', 'entry_close_state', 'src_seq'];
console.log(keys.join(' | '));
for (const e of ents) {
  console.log(keys.map((k) => (e[k] === undefined || e[k] === null ? '' : e[k])).join(' | '));
}
console.log('\n=== 第 1 行原始键(核对字段名) ===');
if (ents[0]) {
  const e = ents[0];
  const brief = {};
  for (const k of Object.keys(e)) if (!/amount|price|discount|tax|cess/i.test(k)) brief[k] = e[k];
  console.log(JSON.stringify(brief, null, 1).slice(0, 3000));
}

console.log('\n=== 该订单挂过的采购入库单(src_bill_no 过滤,可能不支持) ===');
const inb = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '20', src_bill_no: PO });
if (inb.ok) {
  const rs = (inb.data && inb.data.rows) || [];
  console.log('命中 ' + rs.length + ' 张');
  for (const r of rs) console.log(JSON.stringify({ id: r.id, bill_no: r.bill_no, bill_date: r.bill_date, bill_status: r.bill_status, io_status: r.io_status }, null, 0));
} else {
  console.log('该过滤不支持:', inb.error);
}

console.log('\n=== 金蝶里是否已有 PI-2026-11-0036 / CGRK-20261111-* ===');
for (const no of ['PI-2026-11-0036']) {
  const t = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '10', bill_no: no });
  console.log(no, '→', t.ok ? '查到 ' + ((t.data && t.data.rows) || []).length + ' 条' : '查询失败 ' + t.error);
}
const recent = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '60' });
if (recent.ok) {
  const rs = (recent.data && recent.data.rows) || [];
  console.log('\n=== 金蝶最近 60 张采购入库单(看 11-11 有没有挂 YJ-20261103-01 的) ===');
  for (const r of rs.slice(0, 30)) {
    console.log([r.bill_no, r.bill_date, r.bill_status, r.io_status, r.supplier_name || r.supplier_number].join(' | '));
  }
}
