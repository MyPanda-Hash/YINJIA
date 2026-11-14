// 只读:金蝶 vs 本地 MES 单据号集合对账(采购/销售订单)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fetchAppToken, kingdeeGet } from '../../../deploy/kingdee-client.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(HERE, '../../../deploy/config.json'), 'utf8').replace(/^\uFEFF/, ''));
const { token } = await fetchAppToken(cfg.kingdee);
import { createRequire } from 'node:module';
const require = createRequire(join(HERE, '../../../deploy/package.json'));
const mssql = require('mssql');
const pool = await new mssql.ConnectionPool({
  server: cfg.database.server, port: cfg.database.port || 1433, database: cfg.database.database,
  user: cfg.database.user, password: cfg.database.password, options: { encrypt: false, trustServerCertificate: true },
}).connect();

for (const [label, path, table] of [['销售订单', '/jdy/v2/scm/sal_order', 'bd_so_order'], ['采购订单', '/jdy/v2/scm/pur_order', 'bd_pu_order']]) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const d = await kingdeeGet(cfg.kingdee, token, path, { page: String(page), page_size: '200' });
    rows.push(...(d.rows || []));
    if (page >= Number(d.total_page || 1)) break;
  }
  const rs = await new mssql.Request(pool).query(`SELECT 单据编号 FROM ${table}`);
  const local = new Set(rs.recordset.map((r) => String(r.单据编号).trim()));
  const missing = rows.filter((r) => !local.has(String(r.bill_no).trim()));
  const missingC = missing.filter((r) => r.bill_status === 'C');
  console.log(`\n${label}: 金蝶 ${rows.length} 张 / 本地 ${local.size} 张 / 金蝶有本地无 ${missing.length} 张(其中已审核 C ${missingC.length})`);
  const byMonth = {};
  for (const r of missingC) { const m = String(r.bill_date).slice(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; }
  console.log('  缺失(已审核)按月:', Object.keys(byMonth).sort().map((m) => `${m}:${byMonth[m]}`).join('  ') || '无');
}
await pool.close();
