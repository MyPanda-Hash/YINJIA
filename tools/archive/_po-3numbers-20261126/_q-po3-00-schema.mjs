// 只读:摸清采购订单两表的列名 + 本地库新鲜度
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'deploy');
const mssql = createRequire(join(HERE, '_probe.cjs'))('mssql');
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
const pool = await mssql.connect({ ...cfg.database, options: { trustServerCertificate: true } });
const q = async (s) => (await pool.request().query(s)).recordset;

for (const t of ['bd_pu_order', 'bl_pu_order']) {
  const cols = await q(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}' ORDER BY ORDINAL_POSITION`);
  console.log(`\n== ${t} (${cols.length} cols)`);
  console.log(cols.map((c) => c.COLUMN_NAME).join(' | '));
}

const fr = await q(`SELECT TOP 10 单据编号, ISNULL(外部指纹,'') f, ISNULL(修改时间,'') mt, ISNULL(审核时间,'') at
  FROM bd_pu_order ORDER BY ISNULL(修改时间,'') DESC`);
console.log('\n== bd_pu_order 最近修改时间 top10');
for (const r of fr) console.log(` ${r.单据编号} | mt=${r.mt} | at=${r.at} | tail=${String(r.f).slice(-40)}`);

const logs = await q(`SELECT TOP 5 * FROM erp_stock_sync_log ORDER BY 1 DESC`).catch(() => []);
console.log('\n== erp_stock_sync_log top5:', JSON.stringify(logs));
await pool.close();
