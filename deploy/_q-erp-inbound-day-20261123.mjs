/**
 * 只读探针:金蝶采购入库单列表里 2026-11-23 当天的单据(判断草稿/未审核单是否会出现在列表)。
 * 用法:cd deploy; node _q-erp-inbound-day-20261123.mjs [日期=2026-11-23]
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet } from './kingdee-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
const tk = await fetchAppToken(cfg);
cfg.domain = tk.domain || cfg.domain;

const DAY = process.argv[2] || '2026-11-23';
const n = (v) => (v === undefined || v === null ? '' : String(v));
let seen = 0;
for (let p = 1; p <= 4; p++) {
  const data = await kingdeeGet(cfg, tk.token, '/jdy/v2/scm/pur_inbound', { page: String(p), page_size: '100' });
  const rows = data.rows || [];
  if (!rows.length) break;
  for (const r of rows) {
    const created = n(r.create_time).slice(0, 10);
    if (created !== DAY) continue;
    seen++;
    console.log(`  ${n(r.bill_no)} | 单据日期=${n(r.bill_date)} | ${n(r.bill_status)}`
      + ` | 制单人=${n(r.creator_name) || n(r.creator_number)} | create=${n(r.create_time)}`
      + ` | 审核人=${n(r.auditor_name) || '-'} | 数量=${n(r.total_qty)}`);
  }
  if (p >= Number(data.total_page || 1)) break;
}
console.log(`\n[按 create_time == ${DAY} 过滤] 共 ${seen} 张`);
