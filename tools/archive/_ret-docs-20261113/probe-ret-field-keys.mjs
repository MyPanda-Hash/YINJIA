// 探针:真实账套里「销售退货单 sal_in_bound」「生产退料单 inv_pick_ret」的详情键集,
// 并与「销售出库单 sal_out_bound」「生产领料单 inv_pick」逐键对比(只读)。
// 用法: node tools/archive/_ret-docs-20261113/probe-ret-field-keys.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nonEmpty = (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0) && !(typeof v === 'boolean' && v === false);

const DOCS = [
  ['销售出库单', '/jdy/v2/scm/sal_out_bound', '/jdy/v2/scm/sal_out_bound_detail'],
  ['销售退货单', '/jdy/v2/scm/sal_in_bound', '/jdy/v2/scm/sal_in_bound_detail'],
  ['生产领料单', '/jdy/v2/scm/inv_pick', '/jdy/v2/scm/inv_pick_detail'],
  ['生产退料单', '/jdy/v2/scm/inv_pick_ret', '/jdy/v2/scm/inv_pick_ret_detail'],
];

const res = {};
for (const [label, listPath, detailPath] of DOCS) {
  // 取最近 5 张单的详情,统计「键集 + 非空率」
  const l = await kingdeeTryGet(cfg.kingdee, token, listPath, { page: '1', page_size: '6' });
  const bills = l.data?.rows || [];
  const headKeys = new Set(), lineKeys = new Set(), headHit = {}, lineHit = {};
  let n = 0, lines = 0;
  for (const b of bills) {
    const d = await kingdeeTryGet(cfg.kingdee, token, detailPath, { id: b.id });
    await sleep(140);
    const data = d.ok ? d.data : null;
    if (!data) continue;
    n += 1;
    for (const [k, v] of Object.entries(data)) {
      if (k === 'material_entity') continue;
      headKeys.add(k);
      if (nonEmpty(v)) headHit[k] = (headHit[k] || 0) + 1;
    }
    for (const ent of (data.material_entity || [])) {
      lines += 1;
      for (const [k, v] of Object.entries(ent)) {
        lineKeys.add(k);
        if (nonEmpty(v)) lineHit[k] = (lineHit[k] || 0) + 1;
      }
    }
  }
  res[label] = {
    listPath, detailPath, sampleBills: n, sampleLines: lines,
    headKeys: [...headKeys].sort(), lineKeys: [...lineKeys].sort(),
    headFill: Object.fromEntries(Object.entries(headHit).map(([k, v]) => [k, Math.round((v / Math.max(n, 1)) * 100)])),
    lineFill: Object.fromEntries(Object.entries(lineHit).map(([k, v]) => [k, Math.round((v / Math.max(lines, 1)) * 100)])),
  };
  console.log(`${label.padEnd(6)} 样本单=${n} 行=${lines} 头键=${headKeys.size} 行键=${lineKeys.size}`);
}

// 逐键差集:退货/退料 相对 出库/领料
const diff = (aLabel, bLabel) => {
  const a = res[aLabel], b = res[bLabel];
  const extra = (x, y) => x.filter((k) => !y.includes(k));
  return {
    headOnlyInNew: extra(b.headKeys, a.headKeys),
    headMissingInNew: extra(a.headKeys, b.headKeys),
    lineOnlyInNew: extra(b.lineKeys, a.lineKeys),
    lineMissingInNew: extra(a.lineKeys, b.lineKeys),
  };
};
const dSale = diff('销售出库单', '销售退货单');
const dPick = diff('生产领料单', '生产退料单');
console.log('销售退货 vs 销售出库:', JSON.stringify(dSale));
console.log('生产退料 vs 生产领料:', JSON.stringify(dPick));

writeFileSync(new URL('./ret-field-keys.json', import.meta.url), JSON.stringify({ res, dSale, dPick }, null, 2), 'utf8');
