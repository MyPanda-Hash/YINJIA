// 只读:量化「出 31 天窗、但还有未入库」的采购订单有多少(本地同步快照)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mssql from '../../../deploy/node_modules/mssql/index.js';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'deploy');
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
const pool = await mssql.connect({ ...cfg.database, options: { trustServerCertificate: true } });
const q = async (s) => (await pool.request().query(s)).recordset;

const one = (rows) => Object.values(rows[0] || {})[0];

console.log('本地快照基准日(最新外部指纹日期):', one(await q(`SELECT MAX(RIGHT(ISNULL(外部指纹,''),10)) FROM bd_pu_order`)));
console.log('窗口内(>=2026-10-26)订单数:', one(await q(`SELECT COUNT(*) FROM bd_pu_order WHERE 单据日期 >= '2026-10-26'`)));
console.log('出窗(<2026-10-26)订单数  :', one(await q(`SELECT COUNT(*) FROM bd_pu_order WHERE 单据日期 < '2026-10-26'`)));

console.log('\n出窗且「行未入库>0」的订单(有值才算,本地只同步过窗内的行级数):');
const rows = await q(`
  SELECT COUNT(DISTINCT h.单据编号) AS 单数, COUNT(*) AS 行数
  FROM bl_pu_order l JOIN bd_pu_order h ON h.单据编号 = l.单据编号
  WHERE h.单据日期 < '2026-10-26' AND TRY_CAST(l.行未执行数量 AS float) > 0`);
console.log(rows[0]);

console.log('\n出窗、有值、未入库>0 的前 15 张:');
for (const r of await q(`
  SELECT TOP 15 h.单据编号, h.单据日期, h.供应商, COUNT(*) AS 行数, SUM(TRY_CAST(l.行未执行数量 AS float)) AS 未入库合计
  FROM bl_pu_order l JOIN bd_pu_order h ON h.单据编号 = l.单据编号
  WHERE h.单据日期 < '2026-10-26' AND TRY_CAST(l.行未执行数量 AS float) > 0
  GROUP BY h.单据编号, h.单据日期, h.供应商 ORDER BY h.单据日期 DESC`)) {
  console.log(` ${r.单据编号} ${(r.单据日期 instanceof Date ? r.单据日期.toISOString().slice(0,10) : r.单据日期)} ${r.供应商} 行=${r.行数} 未入库合计=${r.未入库合计}`);
}

console.log('\n出窗但行级数为空(从未同步过行级数)的订单数:');
console.log((await q(`
  SELECT COUNT(DISTINCT h.单据编号) AS 单数
  FROM bl_pu_order l JOIN bd_pu_order h ON h.单据编号 = l.单据编号
  WHERE h.单据日期 < '2026-10-26' AND l.行未执行数量 IS NULL`))[0]);

await pool.close();
