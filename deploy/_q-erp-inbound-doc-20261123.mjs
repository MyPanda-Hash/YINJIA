/**
 * 只读探针:核对金蝶采购入库单 CGRK-20261123-03826 本身 + 它涉及的 3 张采购订单当前完成度。
 * 用法:cd deploy; node _q-erp-inbound-doc-20261123.mjs [入库单号]
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
const tk = await fetchAppToken(cfg);
cfg.domain = tk.domain || cfg.domain;
const token = tk.token;

const NO = process.argv[2] || 'CGRK-20261123-03826';
const n = (v) => (v === undefined || v === null ? '' : String(v));

// ① 入库单本身(列表按单号过滤)—— 支持一次查多张
const NOS = process.argv.slice(2);
if (!NOS.length) NOS.push('CGRK-20261123-03826');
for (const NO of NOS) {
  const list = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_inbound', { bill_no: NO, page: '1', page_size: '20' });
  const rows = list.rows || [];
  console.log(`\n== [1] 金蝶采购入库单 ${NO}:列表命中 ${rows.length} 条 ==`);
  for (const r of rows) {
    console.log(`  bill_no=${n(r.bill_no)} 单据日期=${n(r.bill_date)} bill_status=${n(r.bill_status)}`
      + ` 制单人=${n(r.creator_name) || n(r.creator_number)} 制单时间=${n(r.create_time)}`
      + ` 审核人=${n(r.auditor_name)} 审核时间=${n(r.audit_time)} 供应商=${n(r.supplier_name)} 总数量=${n(r.total_qty)}`);
    const d = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_inbound_detail', { id: String(r.id) });
    for (const e of d.material_entity || []) {
      console.log(`  行 seq=${n(e.seq)} 物料=${n(e.material_number)} 入库数量=${n(e.qty)}`
        + ` 批号=${n(e.batch_no) || '-'} 仓库=${n(e.stock_name) || n(e.stock_number) || '-'}`
        + ` 采购订单号=${n(e.src_bill_no) || '-'} 源单行号=${n(e.src_seq) || '-'} 源单分录id=${n(e.src_entry_id) || '-'}`);
    }
  }
}

// ② 这 3 张采购订单此刻的行级完成度
const POS = ['YJ-20261114-03', 'YJ-20261023-05', 'YJ-20260927-02'];
const MAT = 'YJ-SX-005-2';
console.log('\n== [2] 3 张采购订单当前行级完成度(只看 YJ-SX-005-2) ==');
for (const no of POS) {
  const r = (await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { bill_no: no, page: '1', page_size: '5' })).rows?.[0];
  if (!r) { console.log(`  ${no}:金蝶找不到`); continue; }
  const d = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order_detail', { id: String(r.id) });
  const line = (d.material_entity || []).find((m) => n(m.material_number) === MAT);
  console.log(`  ${no} | 表头 close=${n(r.bill_close_state)} io=${n(r.io_status)}`
    + ` | 行 seq=${n(line?.seq)} 数量=${n(line?.qty)} 已入库(in_qty)=${n(line?.in_qty)}`
    + ` 未执行(un_out_qty)=${n(line?.un_out_qty)} 行入库状态=${n(line?.entry_realio_status)} 行关闭=${n(line?.close_state)}`);
}
