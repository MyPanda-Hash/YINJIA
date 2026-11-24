/**
 * 只读取证(真实账套):最近 N 页采购入库单里,挂这 4 张采购订单 / 收 YJ-SX-005-2 的行是谁做的。
 * 用法:cd deploy; node _q-erp-inbound-scan-20261123.mjs [页数=5]
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from './kingdee-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
const tk = await fetchAppToken(cfg);
cfg.domain = tk.domain || cfg.domain;

const POS = new Set(['YJ-20260927-02', 'YJ-20261023-05', 'YJ-20261112-10', 'YJ-20261114-03']);
const MAT = 'YJ-SX-005-2';
const pages = Number(process.argv[2] || 5);
let scanned = 0, hit = 0;

for (let p = 1; p <= pages; p++) {
  const list = await kingdeeGet(cfg, tk.token, '/jdy/v2/scm/pur_inbound', { page: String(p), page_size: '100' });
  const rows = list.rows || [];
  if (!rows.length) break;
  console.log(`[page ${p}] ${rows.length} 张  ${rows[0].bill_date} → ${rows.at(-1).bill_date}  (total_page=${list.total_page})`);
  for (const r of rows) {
    scanned++;
    const d = await kingdeeTryGet(cfg, tk.token, '/jdy/v2/scm/pur_inbound_detail', { id: String(r.id) });
    if (!d.ok) { console.log('  detail fail', r.bill_no, d.error); continue; }
    for (const e of d.data.material_entity || []) {
      const src = String(e.src_bill_no || '');
      const mat = String(e.material_number || '');
      if (POS.has(src) || mat === MAT) {
        hit++;
        console.log(`★ ${r.bill_no} | ${r.bill_date} | ${r.bill_status} | 物料=${mat} qty=${e.qty}`
          + ` | src_bill_no=${src || '-'} src_seq=${e.src_seq ?? '-'} | batch=${e.batch_no || '-'}`
          + ` | 制单人=${r.creator_name || r.creator_number || '-'} 审核人=${r.auditor_name || '-'} create=${r.create_time || '-'}`);
      }
    }
  }
}
console.log(`\n扫描 ${scanned} 张入库单,命中 ${hit} 行`);
