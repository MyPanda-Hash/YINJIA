// 探针⑥:金蝶真实账套「现存量」合计(与 MES kucun / v_stock_balance 对账用,只读)
// 用法: node tools/archive/_kingdee-io-bills-20261113/probe-stock-total.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let page = 1, totalPage = 1, count = 0, sum = 0, neg = 0, withBatch = 0;
const zeroBatch = [];
do {
  const r = await kingdeeTryGet(cfg.kingdee, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(page), page_size: '500' });
  if (!r.ok) { console.error('翻页失败', page, r.error); break; }
  count = Number(r.data?.count ?? 0);
  totalPage = Number(r.data?.total_page ?? 1);
  for (const row of (r.data?.rows || [])) {
    const qty = Number(row.qty ?? row.stock_qty ?? 0);
    sum += qty;
    if (qty < 0) neg += 1;
    if (row.batch_no) withBatch += 1;
  }
  page += 1;
  await sleep(120);
} while (page <= totalPage);

const result = { takenAt: new Date().toISOString(), count, sum: Math.round(sum * 100) / 100, negativeRows: neg, rowsWithBatch: withBatch };
console.log(JSON.stringify(result, null, 2));
writeFileSync(new URL('./kingdee-stock-total.json', import.meta.url), JSON.stringify(result, null, 2), 'utf8');
