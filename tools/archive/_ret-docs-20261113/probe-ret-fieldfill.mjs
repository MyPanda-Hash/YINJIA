// 探针:金蝶真实账套「销售退货单 sal_in_bound」「生产退料单 inv_pick_ret」逐键非空率
// (取最近 N 张已审核单的详情;表头/分录分别统计)
// 用法: node tools/archive/_ret-docs-20261113/probe-ret-fieldfill.mjs [N]
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = Number(process.argv[2] || 30);

const DOCH = [
  ['销售退货单', '/jdy/v2/scm/sal_in_bound', '/jdy/v2/scm/sal_in_bound_detail'],
  ['生产退料单', '/jdy/v2/scm/inv_pick_ret', '/jdy/v2/scm/inv_pick_ret_detail'],
];
const empty = (v) => v === null || v === undefined || v === ''
  || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

const out = {};
for (const [label, listPath, detailPath] of DOCH) {
  const l = await kingdeeTryGet(cfg.kingdee, token, listPath, { page: '1', page_size: String(N) });
  const bills = l.data?.rows || [];
  const headKeys = new Set(); const lineKeys = new Set();
  const headHit = {}; const lineHit = {};
  let n = 0, lines = 0;
  for (const b of bills) {
    const d = await kingdeeTryGet(cfg.kingdee, token, detailPath, { id: b.id });
    await sleep(130);
    if (!d.ok || !d.data) continue;
    n += 1;
    for (const [k, v] of Object.entries(d.data)) {
      if (k === 'material_entity') continue;
      headKeys.add(k);
      if (!empty(v)) headHit[k] = (headHit[k] || 0) + 1;
    }
    for (const e of (d.data.material_entity || [])) {
      lines += 1;
      for (const [k, v] of Object.entries(e)) {
        lineKeys.add(k);
        if (!empty(v)) lineHit[k] = (lineHit[k] || 0) + 1;
      }
    }
  }
  const pct = (hit, total) => Math.round(((hit || 0) / Math.max(total, 1)) * 100);
  const head = [...headKeys].sort().map((k) => ({ key: k, pct: pct(headHit[k], n) }));
  const line = [...lineKeys].sort().map((k) => ({ key: k, pct: pct(lineHit[k], lines) }));
  out[label] = { listPath, detailPath, sampleBills: n, sampleLines: lines, head, line };
  console.log(`\n=== ${label} 样本 ${n} 单 / ${lines} 行`);
  console.log('头 非空率>0:', head.filter((x) => x.pct > 0).map((x) => `${x.key}=${x.pct}%`).join(' '));
  console.log('头 恒空   :', head.filter((x) => x.pct === 0).map((x) => x.key).join(' '));
  console.log('行 非空率>0:', line.filter((x) => x.pct > 0).map((x) => `${x.key}=${x.pct}%`).join(' '));
  console.log('行 恒空   :', line.filter((x) => x.pct === 0).map((x) => x.key).join(' '));
}
writeFileSync(new URL('./ret-fieldfill.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
