// 只读探针:向金蝶查采购订单 YJ-20261103-01 的关闭状态与分录状态
// 目的:验证「商品分录已关闭,不允许下推」的真实成因(订单分录是否已关闭/全部入库)
// 只发 GET,不写任何单据。用法: node tools/archive/_erp-closed-segment-20261111/_q-order-state.mjs [订单号]
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs';

const cfgRaw = JSON.parse(readFileSync(new URL('../../../deploy/push/config.json', import.meta.url), 'utf8'));
const cfg = cfgRaw.kingdee;
const mask = (s) => (!s ? '(空)' : String(s).length <= 6 ? String(s)[0] + '***' : String(s).slice(0, 6) + '…');

const billNo = process.argv[2] || 'YJ-20261103-01';

console.log('== 目标账套 ==');
console.log('clientId      =', mask(cfg.clientId));
console.log('outerInstance =', mask(cfg.outerInstanceId), '(非空=真实账套)');
console.log('domain        =', cfg.domain);

const { token, domain } = await fetchAppToken({ ...cfg, domain: cfg.domain });
console.log('app-token     = OK (domain=' + domain + ')');

const data = await kingdeeGet({ ...cfg, domain }, token, '/jdy/v2/scm/pur_order', {
  page: '1', page_size: '10', bill_no: billNo,
});
const rows = data && data.rows ? data.rows : [];
console.log('\n== pur_order 列表 bill_no=' + billNo + ' 命中 ' + rows.length + ' 条 ==');
for (const r of rows) {
  console.log(JSON.stringify({
    id: r.id, bill_no: r.bill_no, bill_date: r.bill_date,
    bill_status: r.bill_status, bill_close_state: r.bill_close_state,
    io_status: r.io_status, create_time: r.create_time, modify_time: r.modify_time,
  }, null, 0));
}

const hit = rows.find((r) => r.bill_no === billNo);
if (!hit) { console.log('未找到该订单'); process.exit(0); }

const detail = await kingdeeGet({ ...cfg, domain }, token, '/jdy/v2/scm/pur_order_detail', { id: hit.id });
const ents = detail && detail.material_entity ? detail.material_entity : [];
console.log('\n== 订单详情:表头关闭相关 ==');
console.log(JSON.stringify({
  bill_no: detail.bill_no, bill_close_state: detail.bill_close_state,
  io_status: detail.io_status, bill_status: detail.bill_status,
  close_state: detail.close_state,
}, null, 1));

console.log('\n== 分录(行)关闭状态 0已关闭/1未关闭/2手动关闭 ==');
console.log('seq | 行id | material_number | material_name | qty | 已执行 | 未执行 | close_state | io_status');
for (const e of ents) {
  console.log([
    e.seq, e.id, e.material_number, e.material_name, e.qty,
    e.exec_qty ?? e.qty_delivery ?? '', e.qty_no ?? '',
    e.close_state, e.io_status,
  ].join(' | '));
}
console.log('\n== 分录原始键(第1行,用于核对字段名) ==');
if (ents[0]) console.log(JSON.stringify(ents[0], null, 1).slice(0, 4000));

