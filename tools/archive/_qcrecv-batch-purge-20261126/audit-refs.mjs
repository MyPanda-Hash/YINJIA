// 悬挂引用审计：把本次删掉的单号（暂收单/检验单/退回单）拿到各个关联面板里全文比对，
// 看还有没有"单据没了、引用还在"的占位行。
import { readFileSync } from 'node:fs';
import { login, queryPanel } from './api.mjs';

const list = JSON.parse(readFileSync('cleanup-list.json', 'utf8'));
const SL = new Set(list.recv.map((r) => r.no));
const IJ = new Set(list.insp.map((r) => r.no));
const TH = new Set(['TH-2026-10-0003', 'TH-2026-10-0005', 'TH-2026-10-0006']);
const ALL = new Set([...SL, ...IJ, ...TH]);

async function fetchAll(panel, pageSize = 300) {
  const out = []; let page = 1;
  while (true) {
    const d = await queryPanel(panel, { pageNo: page, pageSize });
    const rows = d.list || [];
    if (!rows.length) break;
    out.push(...rows);
    if (out.length >= d.totalSize) break;
    page++;
    if (page > 60) break;
  }
  return out;
}

function hits(panel, rows, { detailKeys = [] } = {}) {
  const found = [];
  for (const r of rows) {
    const scan = (obj, where) => {
      for (const [k, v] of Object.entries(obj)) {
        if (v == null) continue;
        if (typeof v === 'string' && ALL.has(v.trim())) found.push({ panel, where, key: k, val: v.trim(), row: r });
      }
    };
    scan(r, 'head');
    for (const k of detailKeys) for (const it of (r[k]?.items || r[k] || [])) scan(it, k);
  }
  return found;
}

await login();
const report = {};
const scanPanel = async (panel, opts = {}) => {
  let rows;
  try { rows = await fetchAll(panel, opts.pageSize || 300); }
  catch (e) { report[panel] = { error: e.message }; console.log(`\n[${panel}] 读取失败: ${e.message}`); return; }
  const f = hits(panel, rows, opts);
  report[panel] = { rows: rows.length, hits: f.length };
  console.log(`\n[${panel}] 行=${rows.length} 命中=${f.length}`);
  for (const x of f.slice(0, 12)) {
    const no = x.row['单据编号'] || x.row['编号'] || x.row['单号'] || x.row['id'];
    console.log(`   ${no} . ${x.where}.${x.key} = ${x.val}`);
  }
};

await scanPanel('QC_CATALOG', { detailKeys: ['detail'] });
await scanPanel('QC_INSP_REC', { detailKeys: ['detail'] });
await scanPanel('QC_INSP_REC_DETAIL', { detailKeys: ['detail'] });
await scanPanel('PURCHASE_IN', { detailKeys: ['detail'] });
await scanPanel('QC_RETURN', { detailKeys: ['detail'] });
await scanPanel('QC_TC_IN', { detailKeys: ['detail'] });
await scanPanel('QC_INSP', { detailKeys: ['detail'] });
await scanPanel('QC_RECV', { detailKeys: ['detail'] });

console.log('\n=== 汇总 ===');
for (const [k, v] of Object.entries(report)) console.log(k.padEnd(22), JSON.stringify(v));
