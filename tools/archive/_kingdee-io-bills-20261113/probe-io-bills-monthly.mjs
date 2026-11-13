// 探针④:按月对照 —— 金蝶真实账套每种出入库单据「2026-09/10/11 各多少张」(只读)
// 关键发现:星辰 v2 列表接口按单据日期过滤的参数名是 `start_bill_date` / `end_bill_date`
//          (startdate/enddate/begindate/expiredate 均无效,传了也不报错、count 不变)
// 用法: node tools/archive/_kingdee-io-bills-20261113/probe-io-bills-monthly.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const list = JSON.parse(readFileSync(new URL('./io-bills.json', import.meta.url), 'utf8')).filter((x) => x.exists);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MONTHS = [
  ['2026-07', '2026-07-01', '2026-07-31'],
  ['2026-08', '2026-08-01', '2026-08-31'],
  ['2026-09', '2026-09-01', '2026-09-30'],
  ['2026-10', '2026-10-01', '2026-10-31'],
  ['2026-11', '2026-11-01', '2026-11-30'],
];

const out = [];
for (const it of list) {
  const row = { label: it.label, path: it.path, dir: it.dir, total: it.count, audited: it.audited, months: {} };
  for (const [m, s, e] of MONTHS) {
    const r = await kingdeeTryGet(cfg.kingdee, token, it.path, { page: '1', page_size: '5', start_bill_date: s, end_bill_date: e });
    row.months[m] = r.ok ? Number(r.data?.count ?? 0) : null;
    await sleep(120);
  }
  console.log(`${it.label.padEnd(12)} 合计=${String(row.total).padStart(5)}  ` +
    MONTHS.map(([m]) => `${m}=${String(row.months[m]).padStart(4)}`).join('  '));
  out.push(row);
}
writeFileSync(new URL('./io-bills-monthly.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
