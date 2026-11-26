// 只读:金蝶真实账套 —— 采购入库单 与 采购订单行现状
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'deploy');
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
const tk = await fetchAppToken(cfg);
cfg.domain = tk.domain || cfg.domain;
const token = tk.token;
const n = (v) => (v === undefined || v === null ? '' : String(v));
console.log(`[erp] token ok account=${cfg.clientId} domain=${cfg.domain}`);

const inboundNo = process.argv[2] || 'CGRK-20261125-03863';
const poNos = process.argv.slice(3);

console.log(`\n########## 采购入库单 ${inboundNo}`);
try {
  const list = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_inbound', { bill_no: inboundNo, page: '1', page_size: '20' });
  const rows = list.rows || [];
  console.log(`[list] 命中 ${rows.length} 条`);
  for (const r of rows) {
    console.log(` bill_no=${n(r.bill_no)} 日期=${n(r.bill_date)} 状态=${n(r.bill_status)} 供应商=${n(r.supplier_name)} 制单=${n(r.creator_name) || n(r.emp_name)} 创建=${n(r.create_time)} 审核=${n(r.auditor_name)} ${n(r.audit_time)} 关闭=${n(r.bill_close_state)} 备注=${n(r.remark) || '(空)'}`);
    const d = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_inbound_detail', { id: String(r.id) });
    for (const e of d.material_entity || []) {
      console.log(`   seq=${n(e.seq)} ${n(e.material_number)} ${n(e.material_name)} qty=${n(e.qty)} 实收=${n(e.real_qty) || n(e.base_qty)} 仓库=${n(e.stock_name)} batch=${n(e.batch_no)} 源单=${n(e.src_bill_no) || '-'} src_seq=${n(e.src_seq) || '-'} 退回=${n(e.return_qty)}`);
    }
  }
  if (!rows.length) console.log('  → 金蝶里没有这个单号');
} catch (e) { console.log('[inbound] 失败:', e.message); }

for (const no of poNos) {
  console.log(`\n########## 采购订单 ${no}`);
  try {
    const list = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { bill_no: no, page: '1', page_size: '10' });
    const head = (list.rows || [])[0];
    if (!head) { console.log('  金蝶找不到'); continue; }
    console.log(` head 状态=${n(head.bill_status)} 关闭=${n(head.bill_close_state)} 入库状态=${n(head.io_status)} 实际=${n(head.real_io_status)} 供应商=${n(head.supplier_name)} 日期=${n(head.bill_date)} 修改=${n(head.modify_time)}`);
    const d = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order_detail', { id: String(head.id) });
    for (const m of d.material_entity || []) {
      const qty = Number(m.qty || 0);
      console.log(`   seq=${n(m.seq)} ${n(m.material_number)} ${n(m.material_name)} 数=${qty} in_qty=${n(m.in_qty)} un_out_qty=${n(m.un_out_qty)} 行入库状态=${n(m.entry_realio_status)} 行执行=${n(m.entry_ios_tatus)} 关闭=${n(m.close_state)}`);
    }
  } catch (e) { console.log('  失败:', e.message); }
}
