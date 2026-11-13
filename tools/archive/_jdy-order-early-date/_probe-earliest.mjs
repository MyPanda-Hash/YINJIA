// 只读探测:金蝶销售订单/采购订单的「最早一张」到底到哪个月
// 用法:node tools/archive/_jdy-order-early-date/_probe-earliest.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, '../../../deploy/config.json'), 'utf8').replace(/^\uFEFF/, ''));
console.log('账套 clientId =', cfg.kingdee.clientId, 'domain =', cfg.kingdee.domain);

const { token } = await fetchAppToken(cfg.kingdee);

const targets = [
  ['销售订单', '/jdy/v2/scm/sal_order'],
  ['采购订单', '/jdy/v2/scm/pur_order'],
];

for (const [label, path] of targets) {
  console.log(`\n========== ${label} ${path} ==========`);
  // 1) 各状态条数(全部 / 已审核C / 未审核D / 作废Z / 关闭?)
  for (const st of ['', 'C', 'D', 'Z']) {
    const q = { page: '1', page_size: '1' };
    if (st) q.bill_status = st;
    try {
      const d = await kingdeeGet(cfg.kingdee, token, path, q);
      console.log(`  状态[${st || '不限'}] count = ${d.count}`);
    } catch (e) {
      console.log(`  状态[${st || '不限'}] 失败:${e.message}`);
    }
  }
  // 2) 分页扫全量,记录 bill_date / create_time 的极值(最多 100 页 x 200 条)
  const s = { n: 0, minBill: null, maxBill: null, minCreate: null, maxCreate: null, byMonth: {} };
  const PAGE = 200, MAXP = 100;
  for (let page = 1; page <= MAXP; page++) {
    const d = await kingdeeGet(cfg.kingdee, token, path, { page: String(page), page_size: String(PAGE) });
    const rows = d.rows || [];
    for (const r of rows) {
      s.n++;
      const bd = String(r.bill_date || '').slice(0, 10);
      const ct = String(r.create_time || '').slice(0, 10) || String(r.create_date || '').slice(0, 10);
      if (bd) { if (!s.minBill || bd < s.minBill) s.minBill = bd; if (!s.maxBill || bd > s.maxBill) s.maxBill = bd; s.byMonth[bd.slice(0, 7)] = (s.byMonth[bd.slice(0, 7)] || 0) + 1; }
      if (ct) { if (!s.minCreate || ct < s.minCreate) s.minCreate = ct; if (!s.maxCreate || ct > s.maxCreate) s.maxCreate = ct; }
    }
    if (page >= Number(d.total_page || 1) || !rows.length) break;
  }
  console.log(`  扫描 ${s.n} 条(接口 count=${(await kingdeeGet(cfg.kingdee, token, path, { page: '1', page_size: '1' })).count})`);
  console.log(`  单据日期 最早 ${s.minBill} / 最晚 ${s.maxBill};创建日期 最早 ${s.minCreate} / 最晚 ${s.maxCreate}`);
  const months = Object.keys(s.byMonth).sort();
  console.log('  按月:', months.map((m) => `${m}:${s.byMonth[m]}`).join('  '));
  // 3) 抽样最早 3 张
  const first = [];
  for (const m of months.slice(0, 1)) {
    for (let page = 1; page <= MAXP && first.length < 3; page++) {
      const d = await kingdeeGet(cfg.kingdee, token, path, { page: String(page), page_size: String(PAGE) });
      for (const r of d.rows || []) {
        if (String(r.bill_date || '').slice(0, 7) === m && first.length < 3) {
          first.push({ bill_no: r.bill_no, bill_date: r.bill_date, bill_status: r.bill_status, create_time: r.create_time, 客户或供应商: r.customer_name || r.supplier_name });
        }
      }
      if (page >= Number(d.total_page || 1)) break;
    }
  }
  console.log('  最早月份抽样:', JSON.stringify(first, null, 0));
}
