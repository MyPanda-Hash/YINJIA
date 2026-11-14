// 只读:确认「4 月之前到底有没有单」——销售/采购订单按月末分组 + 早于 2025-04 的明细
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, '../../../deploy/config.json'), 'utf8').replace(/^\uFEFF/, ''));
const { token } = await fetchAppToken(cfg.kingdee);

async function scan(path) {
  const all = [];
  for (let page = 1; page <= 100; page++) {
    const d = await kingdeeGet(cfg.kingdee, token, path, { page: String(page), page_size: '200' });
    const rows = d.rows || [];
    all.push(...rows);
    if (page >= Number(d.total_page || 1) || !rows.length) break;
  }
  return all;
}

for (const [label, path] of [['销售订单', '/jdy/v2/scm/sal_order'], ['采购订单', '/jdy/v2/scm/pur_order']]) {
  const rows = await scan(path);
  const before = rows.filter((r) => String(r.bill_date || '').slice(0, 10) < '2025-04-01');
  console.log(`\n===== ${label} 共 ${rows.length} 张 =====`);
  console.log(`单据日期早于 2025-04-01 的:${before.length} 张`);
  for (const r of before.sort((a, b) => String(a.bill_date).localeCompare(String(b.bill_date)))) {
    console.log(`  ${String(r.bill_date).slice(0, 10)}  ${r.bill_no}  状态=${r.bill_status}  录入=${String(r.create_time || '').slice(0, 19)}  ${r.customer_name || r.supplier_name || ''}`);
  }
  // 录入(创建)时间最早的 3 张 —— 看账套是哪天开始录单的
  const byCreate = rows.filter((r) => r.create_time).sort((a, b) => String(a.create_time).localeCompare(String(b.create_time))).slice(0, 3);
  console.log('创建时间最早 3 张:' + byCreate.map((r) => `${String(r.create_time).slice(0, 19)} ${r.bill_no}(单据日期 ${String(r.bill_date).slice(0, 10)})`).join(' | '));
  const march = rows.filter((r) => String(r.bill_date || '').slice(0, 7) === '2025-03').length;
  const feb = rows.filter((r) => String(r.bill_date || '').slice(0, 7) === '2025-02').length;
  console.log(`2025-02:${feb} 张  2025-03:${march} 张  2025-04:${rows.filter((r) => String(r.bill_date || '').slice(0, 7) === '2025-04').length} 张`);
}
