// 探针⑤:产品入库 / 生产领料 / 生产退料 这 3 个接口**不支持** start_bill_date 过滤
//        (传了不报错、count 恒等于全量),只能翻页按 bill_date 自己分组。
// 用法: node tools/archive/_kingdee-io-bills-20261113/probe-io-bills-monthly-paged.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TARGETS = [
  ['产品入库单', '/jdy/v2/scm/inv_product', 'in'],
  ['生产领料单', '/jdy/v2/scm/inv_pick', 'out'],
  ['生产退料单', '/jdy/v2/scm/inv_pick_ret', 'in'],
];
const PS = 100;                                  // 金蝶上限 100(page_size=500 会被压回 100)
const out = [];

for (const [label, path, dir] of TARGETS) {
  const months = {};
  let page = 1, totalPage = 1, total = 0;
  do {
    const r = await kingdeeTryGet(cfg.kingdee, token, path, { page: String(page), page_size: String(PS) });
    if (!r.ok) { console.error('翻页失败', path, page, r.error); break; }
    total = Number(r.data?.count ?? 0);
    totalPage = Number(r.data?.total_page ?? 1);
    for (const row of (r.data?.rows || [])) {
      const m = String(row.bill_date || '').slice(0, 7);
      if (m) months[m] = (months[m] || 0) + 1;
    }
    page += 1;
    await sleep(90);
  } while (page <= totalPage);
  console.log(`${label.padEnd(10)} 合计=${total}  月份分布=${JSON.stringify(months)}`);
  out.push({ label, path, dir, total, months });
}

writeFileSync(new URL('./io-bills-monthly-paged.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
