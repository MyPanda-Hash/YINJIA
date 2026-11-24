// 只读取证(真实账套 359797):采购订单表头 + 各分录 in_qty / un_out_qty / close_state
// 只发 GET。运行: node tools/archive/_erp-link-full-20261124/_q-order-lines.mjs YJ-20260924-04 YJ-20261014-03
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(here, '../../../deploy/config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
const { token, domain } = await fetchAppToken(cfg);
cfg.domain = domain;
const n = (v) => (v === undefined || v === null ? '' : String(v));

for (const no of process.argv.slice(2)) {
  const list = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { bill_no: no, page: '1', page_size: '5' });
  const h = (list.rows || []).find((r) => n(r.bill_no) === no);
  if (!h) { console.log(no + ' → 金蝶列表未命中'); continue; }
  console.log(`\n### ${no} 日期=${n(h.bill_date)} bill_status=${n(h.bill_status)} bill_close_state=${n(h.bill_close_state)} io_status=${n(h.io_status)} 供应商=${n(h.supplier_name)}`);
  const d = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order_detail', { id: h.id });
  for (const m of d.material_entity || []) {
    const qty = Number(m.qty || 0), un = Number(m.un_out_qty);
    const over = Number.isFinite(un) && un < 0 ? `  ← 超收 ${-un}` : '';
    console.log(`  seq=${n(m.seq)} ${n(m.material_number)} 订单量=${qty} 已入库=${n(m.in_qty)} 未执行=${n(m.un_out_qty)}`
      + ` 行关闭=${n(m.close_state)}(0 已关闭/1 未关闭) 行入库状态=${n(m.entry_realio_status)}${over}`);
  }
}
