// 只读取证:金蝶"真实账套"里 YJ-20261027-05 的订单行数量 / 已入库情况,与 CGRK-20261107-03645 是否存在。
// 用 deploy/config.json(359797 outerInstanceId=580147507460444160,真实账套)只发 GET,不写任何数据。
// 运行: node tools/archive/_erp-overreceive-20261107/q-03-kingdee-po.mjs
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(here, '../../../deploy/config.json'), 'utf8')).kingdee;
console.log('账套 clientId=', cfg.clientId, 'outerInstanceId=', cfg.outerInstanceId);

const { token, domain } = await fetchAppToken(cfg);
cfg.domain = domain;
console.log('token ok, domain=', domain);

const PO = 'YJ-20261027-05';
const list = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { page: '1', page_size: '10', bill_no: PO });
const rows = list.rows || [];
console.log('\n=== pur_order 列表命中 ===');
for (const r of rows) {
  console.log(JSON.stringify({
    id: r.id, bill_no: r.bill_no, bill_date: r.bill_date, supplier: r.supplier_name || r.supplier_number,
    bill_status: r.bill_status, io_status: r.io_status, bill_close_state: r.bill_close_state,
    total_amount: r.total_amount, all_amount: r.all_amount,
  }, null, 0));
}
const hit = rows.find((r) => r.bill_no === PO);
if (!hit) { console.log('!! 列表未命中该订单(可能号不同)'); process.exit(0); }

const detail = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order_detail', { id: String(hit.id) });
const ents = detail.material_entity || [];
console.log('\n=== 订单分录(全字段) 共', ents.length, '行 ===');
for (const e of ents) {
  console.log('\n-- seq=', e.seq, ' material=', e.material_number, e.material_name, '--');
  console.log(JSON.stringify(e, null, 2));
}
console.log('\n=== 订单头(全字段) ===');
console.log(JSON.stringify(detail, null, 2).slice(0, 4000));

console.log('\n=== CGRK-20261107-03645 是否已在金蝶 ===');
const inb = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '10', bill_no: 'CGRK-20261107-03645' });
console.log(JSON.stringify(inb).slice(0, 2000));

console.log('\n=== 该订单挂过的采购入库单(按 src_bill_no 过滤尝试) ===');
const inb2 = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '20', src_bill_no: PO });
console.log(JSON.stringify(inb2).slice(0, 4000));
