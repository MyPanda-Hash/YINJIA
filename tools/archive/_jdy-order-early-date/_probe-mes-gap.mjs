// 只读:金蝶 销售/采购订单「已审核(C)」按 2026-09-01 切分,和本地 MES 库对账
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, '../../../deploy/config.json'), 'utf8').replace(/^\uFEFF/, ''));
const { token } = await fetchAppToken(cfg.kingdee);

for (const [label, path] of [['销售订单', '/jdy/v2/scm/sal_order'], ['采购订单', '/jdy/v2/scm/pur_order']]) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const d = await kingdeeGet(cfg.kingdee, token, path, { page: String(page), page_size: '200' });
    rows.push(...(d.rows || []));
    if (page >= Number(d.total_page || 1)) break;
  }
  const c = rows.filter((r) => r.bill_status === 'C');
  const cut = '2026-09-01';
  const old = c.filter((r) => String(r.bill_date || '').slice(0, 10) < cut);
  const recent = c.filter((r) => String(r.bill_date || '').slice(0, 10) >= cut);
  console.log(`${label}: 全部 ${rows.length} 张,其中已审核 C ${c.length} 张`);
  console.log(`  单据日期 < ${cut}:${old.length} 张(最早 ${old.length ? old.map((r) => String(r.bill_date).slice(0, 10)).sort()[0] : '-'})`);
  console.log(`  单据日期 >= ${cut}:${recent.length} 张`);
}
