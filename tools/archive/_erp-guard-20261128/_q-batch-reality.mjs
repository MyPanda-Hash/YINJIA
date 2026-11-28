/**
 * 只读探针(2026-11-28):金蝶「现存量」与「商品档案」的批号维度实况 —— 回答
 *   「把 MES 批次号推上去,库存能不能按批号对齐?」
 *
 *   · 现存量接口 /jdy/v2/inv/inv_inventory_ims 返回的 batch_no 是否有值
 *     (真实账套 2026-11-28 实测:1432 行,0 行有批号 ⇒ 同步回 MES 的批号维度恒空);
 *   · 商品档案 is_batch 的比例(真实账套 2463/3991 = 61.7%;测试沙箱 0/298)。
 *
 * 用法(仓库根目录):node tools/archive/_erp-guard-20261128/_q-batch-reality.mjs [prod|sandbox] [pages]
 * 只发 GET。
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const which = (process.argv[2] || 'prod').toLowerCase();
const pages = Number(process.argv[3] || 3);
const raw = which === 'prod'
  ? JSON.parse(readFileSync(resolve(root, 'deploy/config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee
  : JSON.parse(readFileSync(resolve(root, 'deploy/push/config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
const cfg = which === 'prod' ? raw : { ...raw, outerInstanceId: raw.sandboxInstanceId };
const tk = await fetchAppToken(cfg);
if (tk.domain) cfg.domain = tk.domain;
const n = (v) => (v === undefined || v === null ? '' : String(v));

// ① 现存量里的批号
let total = 0, withBatch = 0;
const samples = [];
for (let p = 1; p <= pages; p++) {
  const d = await kingdeeGet(cfg, tk.token, '/jdy/v2/inv/inv_inventory_ims', { page: String(p), page_size: '500' });
  const rows = d.rows || [];
  if (!rows.length) break;
  for (const r of rows) {
    total++;
    const b = n(r.batch_no);
    if (b) { withBatch++; if (samples.length < 8) samples.push(`  ${n(r.material_number)}|${n(r.stock_number)}|batch=${b}|qty=${n(r.qty)}`); }
  }
  if (rows.length < 500) break;
}
console.log(`[${which}] 现存量行数=${total} 带批号行数=${withBatch}`);
if (samples.length) console.log(samples.join('\n'));

// ② 商品档案 is_batch 比例
let mTotal = 0, mBatch = 0; const list = [];
for (let p = 1; p <= 20; p++) {
  const d = await kingdeeGet(cfg, tk.token, '/jdy/v2/bd/material', { page: String(p), page_size: '500' });
  const rows = d.rows || [];
  if (!rows.length) break;
  for (const m of rows) {
    mTotal++;
    if (m.is_batch === true) { mBatch++; if (list.length < 10) list.push(`  ${n(m.number)} ${n(m.name)}`); }
  }
  if (rows.length < 500) break;
}
console.log(`[${which}] 商品 ${mTotal} 个,启用批号管理 ${mBatch} 个 (${(mBatch / (mTotal || 1) * 100).toFixed(1)}%)`);
console.log(list.join('\n') || '  (无启用批号管理的商品)');
