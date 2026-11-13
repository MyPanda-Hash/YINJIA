// 探针②:上一步命中的出入库单据,各自的「最新 / 最早」单据日期(只读)
// 用法: node tools/archive/_kingdee-io-bills-20261113/probe-io-bills-dates.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const list = JSON.parse(readFileSync(new URL('./io-bills.json', import.meta.url), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (row) => ({ billno: row?.bill_no, date: row?.bill_date, status: row?.bill_status });

const res = [];
for (const it of list.filter((x) => x.exists && x.count > 0)) {
  const PS = 5;                                   // page_size=1 时金蝶返回空 rows,用 5 取整再挑首尾
  const lastPage = Math.max(1, Math.ceil(it.count / PS));
  const first = await kingdeeTryGet(cfg.kingdee, token, it.path, { page: '1', page_size: String(PS) });
  await sleep(130);
  const last = await kingdeeTryGet(cfg.kingdee, token, it.path, { page: String(lastPage), page_size: String(PS) });
  await sleep(130);
  const frows = first.data?.rows || first.data?.list || [];
  const lrows = last.data?.rows || last.data?.list || [];
  const newest = pick(frows[0]);
  const oldest = pick(lrows[lrows.length - 1] || lrows[0]);
  console.log(`${it.label.padEnd(12)} count=${String(it.count).padStart(5)}  最新=${newest.date} ${newest.billno}   最早=${oldest.date} ${oldest.billno}`);
  res.push({ ...it, newest, oldest });
}
writeFileSync(new URL('./io-bills-dates.json', import.meta.url), JSON.stringify(res, null, 2), 'utf8');
