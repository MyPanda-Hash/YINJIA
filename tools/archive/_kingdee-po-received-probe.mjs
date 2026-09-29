// _kingdee-po-received-probe.mjs — 只读探针:查金蝶真实账套里采购订单的行执行(已入库)数量。
// 用法: node tools/archive/_kingdee-po-received-probe.mjs [订单号,默认 YJ-20260921-04]
// 流程: fetchAppToken → GET /jdy/v2/scm/pur_order?bill_no= → GET /jdy/v2/scm/pur_order_detail?id=
// 只读查询,不写任何单据。不打印任何密钥/token。
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs';

const poNo = process.argv[2] || 'YJ-20260921-04';
const cfg = JSON.parse(readFileSync(new URL('../../deploy/push/config.json', import.meta.url), 'utf8')).kingdee;
const { token, domain } = await fetchAppToken(cfg);
console.log(`已连接真实账套(domain=${domain})`);

const list = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { page: '1', page_size: '10', bill_no: poNo });
const row = (list.rows || []).find((r) => r.bill_no === poNo);
if (!row) { console.error(`金蝶账套内无采购订单[${poNo}]`); process.exit(1); }
console.log(`订单 ${row.bill_no} id=${row.id} 状态字段=${JSON.stringify({
  bill_status: row.bill_status, audit_status: row.audit_status ?? row.status,
})}`);

const det = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order_detail', { id: row.id });
const entries = det.material_entity || [];
console.log(`分录 ${entries.length} 条;第 1 条全部字段名:\n  ${Object.keys(entries[0] || {}).join(', ')}`);
for (const e of entries) {
  const pick = {};
  for (const [k, v] of Object.entries(e)) if (/qty|数量|seq$|execut|执行|stock/i.test(k)) pick[k] = v;
  console.log(`行 seq=${e.seq}: ` + JSON.stringify(pick));
}

// 追查:哪些入库单挂了本订单(只读;列表接口不支持 src 过滤时跳过)
const { kingdeeTryGet } = await import('../../deploy/kingdee-client.mjs');
const inb = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/pur_inbound',
  { page: '1', page_size: '20', src_bill_no: poNo });
if (inb.ok) {
  const rows = (inb.data.rows || []);
  console.log(`\n列表返回 ${rows.length} 张(第1行字段含 src_bill_no=${'src_bill_no' in (rows[0] || {})}):`);
  for (const r of rows) console.log(`  ${r.bill_no}  日期=${r.bill_date}  src_bill_no=${r.src_bill_no ?? '(行上无此字段)'}  状态=${r.bill_status}`);
} else {
  console.log(`\n(入库单列表不支持 src_bill_no 过滤,跳过溯源: ${inb.error})`);
}
