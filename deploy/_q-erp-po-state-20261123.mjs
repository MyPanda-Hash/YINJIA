/**
 * 只读探针:金蝶(ERP)侧这 4 张采购订单的真实完成情况 + MES 侧对照
 * 用法:cd deploy; node _q-erp-po-state-20261123.mjs [单号...]
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mssql from 'mssql';
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from './kingdee-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
const POS = process.argv.slice(2);

const tk = await fetchAppToken(cfg.kingdee);
if (tk.domain && tk.domain !== cfg.kingdee.domain) cfg.kingdee.domain = tk.domain;
const token = tk.token;
console.log(`[erp] token ok, account=${cfg.kingdee.clientId}`);

const norm = (v) => (v === undefined || v === null ? '' : String(v));
for (const no of POS) {
  console.log(`\n########## ${no} ##########`);
  // ① 列表按单号过滤
  let head = null;
  try {
    const data = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/scm/pur_order', { bill_no: no, page: '1', page_size: '20' });
    head = (data.rows || []).find((r) => norm(r.bill_no) === no) || (data.rows || [])[0] || null;
    console.log(`[list] 命中 ${(data.rows || []).length} 条`);
  } catch (e) { console.log('[list] 失败:', e.message); }
  if (!head) { console.log('  金蝶列表里找不到该单'); continue; }
  console.log(`[head] bill_no=${head.bill_no} bill_status=${head.bill_status} bill_close_state=${head.bill_close_state}`
    + ` io_status=${head.io_status} real_io_status=${head.real_io_status} total_amount=${head.total_amount}`);
  console.log(`[head keys] ${Object.keys(head).join(',')}`);

  // ② 详情
  try {
    const d = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/scm/pur_order_detail', { id: head.id });
    const lines = d.material_entity || [];
    console.log(`[detail] 行数=${lines.length}`);
    console.log(`[line keys] ${Object.keys(lines[0] || {}).join(',')}`);
    for (const m of lines) {
      const qty = Number(m.qty || 0), un = Number(m.un_out_qty ?? NaN);
      console.log(`  seq=${norm(m.seq)} 物料=${norm(m.material_number)} 数量=${qty}`
        + ` 已入库=${Number.isFinite(un) ? qty - un : '?'} 未执行(un_out_qty)=${norm(m.un_out_qty)}`
        + ` 行入库状态=${norm(m.entry_realio_status)} 行执行状态=${norm(m.entry_ios_tatus)}`
        + ` 行关闭=${norm(m.close_state)} in_qty=${norm(m.in_qty)} 退货=${norm(m.return_qty)}`);
    }
  } catch (e) { console.log('[detail] 失败:', e.message); }
}
