// 只读:扫最近 N 页采购入库单,找哪几张单收过指定采购订单行(验「已入库 1000」是不是真的)
// 用法: node _q-po3-13-receipts.mjs YJ-20261014-03 [页数=5]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'deploy');
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
const tk = await fetchAppToken(cfg);
cfg.domain = tk.domain || cfg.domain;
const n = (v) => (v === undefined || v === null ? '' : String(v));

const POS = new Set((process.argv[2] || '').split(',').map((s) => s.trim()).filter(Boolean));
const pages = Number(process.argv[3] || 5);
let scanned = 0, hit = 0, sum = 0;

for (let p = 1; p <= pages; p++) {
  const list = await kingdeeGet(cfg, tk.token, '/jdy/v2/scm/pur_inbound', { page: String(p), page_size: '100' });
  const rows = list.rows || [];
  if (!rows.length) break;
  console.log(`[page ${p}] ${rows.length} 张  ${n(rows[0].bill_date)} → ${n(rows.at(-1).bill_date)}`);
  for (const r of rows) {
    scanned++;
    const d = await kingdeeTryGet(cfg, tk.token, '/jdy/v2/scm/pur_inbound_detail', { id: String(r.id) });
    if (!d.ok) { console.log('  detail fail', r.bill_no, d.error); continue; }
    for (const e of d.data.material_entity || []) {
      const src = n(e.src_bill_no);
      if (!POS.has(src)) continue;
      hit++; sum += Number(e.qty || 0);
      console.log(` ✔ ${n(r.bill_no)} 日期=${n(r.bill_date)} 状态=${n(r.bill_status)} | ${n(e.material_number)} qty=${n(e.qty)} src=${src}#${n(e.src_seq)} batch=${n(e.batch_no) || '(空)'} | 制单=${n(r.creator_name)}`);
    }
  }
}
console.log(`\n扫描 ${scanned} 张入库单,命中 ${hit} 行,合计 ${sum}`);
