// 探针:金蝶云·星辰「真实账套」里到底有哪些出入库单据、各有几张(只读,不动任何数据)
// 用法: node tools/archive/_kingdee-io-bills-20261113/probe-io-bills.mjs
// 产出: 同目录 io-bills.json(逐接口 count / 已审核 count / 样例单号)
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);
console.log('账套: outerInstanceId =', cfg.kingdee.outerInstanceId, '(真实账套)');

// 候选:金蝶星辰 v2 里所有会动库存的单据(含别名写法,命不中就当不存在)
const CANDS = [
  ['采购入库单', '/jdy/v2/scm/pur_inbound', 'in'],
  ['采购退货单', '/jdy/v2/scm/pur_ret', 'out'],
  ['销售出库单', '/jdy/v2/scm/sal_out_bound', 'out'],
  ['销售退货单', '/jdy/v2/scm/sal_in_bound', 'in'],
  ['产品入库单', '/jdy/v2/scm/inv_product', 'in'],
  ['生产领料单', '/jdy/v2/scm/inv_pick', 'out'],
  ['生产退料单', '/jdy/v2/scm/inv_pick_ret', 'in'],
  ['生产退料单(别名)', '/jdy/v2/pm/pick_return', 'in'],
  ['其他入库单', '/jdy/v2/scm/inv_other_in', 'in'],
  ['其他出库单', '/jdy/v2/scm/inv_other_out', 'out'],
  ['调拨出库单', '/jdy/v2/scm/inv_tfout', 'out'],
  ['调拨入库单', '/jdy/v2/scm/inv_tfin', 'in'],
  ['移仓单', '/jdy/v2/scm/inv_tfmove', 'move'],
  ['盘点单', '/jdy/v2/scm/inv_check_bill', 'adjust'],
  ['组装单', '/jdy/v2/scm/inv_assemble', 'assemble'],
  ['拆卸单', '/jdy/v2/scm/inv_disassemble', 'assemble'],
  ['委外领料单', '/jdy/v2/scm/inv_subcontract_pick', 'out'],
  ['委外入库单', '/jdy/v2/scm/inv_subcontract_in', 'in'],
  ['生产入库(别名)', '/jdy/v2/pm/prod_inbound', 'in'],
  ['库存调整单', '/jdy/v2/scm/inv_cost_adjust', 'adjust'],
];

const out = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [label, path, dir] of CANDS) {
  const r = await kingdeeTryGet(cfg.kingdee, token, path, { page: '1', page_size: '1' });
  if (!r.ok) {
    console.log(`❌ ${label.padEnd(14)} ${path} → ${r.error}`);
    out.push({ label, path, dir, exists: false, error: r.error });
    await sleep(120);
    continue;
  }
  const total = Number(r.data?.count ?? r.data?.total ?? NaN);
  const rows = r.data?.rows || r.data?.list || [];
  // 已审核单数(金蝶库存只认已审核)
  const ra = await kingdeeTryGet(cfg.kingdee, token, path, { bill_status: 'C', page: '1', page_size: '1' });
  const audited = ra.ok ? Number(ra.data?.count ?? ra.data?.total ?? NaN) : NaN;
  // 取最近一页,拿单号/日期样例
  const rs = await kingdeeTryGet(cfg.kingdee, token, path, { page: '1', page_size: '5' });
  const sample = (rs.ok ? (rs.data?.rows || rs.data?.list || []) : []).map((x) => ({
    billno: x.billno || x.bill_no || x.number,
    date: x.billdate || x.bill_date || x.create_time,
    status: x.bill_status,
  }));
  console.log(`✅ ${label.padEnd(14)} ${path} → count=${total} 已审核=${audited} 样例=${JSON.stringify(sample.slice(0, 2))}`);
  out.push({ label, path, dir, exists: true, count: total, audited, firstRowKeys: rows[0] ? Object.keys(rows[0]).length : 0, sample });
  await sleep(150);
}

writeFileSync(new URL('./io-bills.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
console.log('\n命中接口', out.filter((x) => x.exists).length, '/', CANDS.length, '→ io-bills.json');
