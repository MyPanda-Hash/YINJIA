// 一次性探针:仓库基础资料到底在哪、齐不齐(文档用到的仓库值 vs 档案表)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

for (const pc of ['WH', 'CKDA']) {
  const p = (await q(`SELECT panel_code, panel_name, head_table, line_table FROM yj_panel WHERE panel_code=N'${pc}'`))[0];
  console.log(`${pc} ${p?.panel_name}: ${p?.head_table || p?.line_table}`);
  const t = p?.head_table || p?.line_table;
  if (t) { try { console.log('  行:', JSON.stringify(await q(`SELECT TOP 10 * FROM ${t}`))); } catch (e) { console.log('  ', e.message); } }
}
console.log('\n文档里用到的仓库值(去重):');
console.log('  bd_purchase_in:', JSON.stringify((await q("SELECT DISTINCT 仓库 v FROM bd_purchase_in WHERE ISNULL(仓库,'')<>''")).map(r => r.v)));
console.log('  bd_sale_out   :', JSON.stringify((await q("SELECT DISTINCT 仓库 v FROM bd_sale_out WHERE ISNULL(仓库,'')<>''")).map(r => r.v)));
console.log('\n全库搜「半成品仓」出现在哪些表列:');
for (const r of await q(`
  SELECT c.TABLE_NAME t, c.COLUMN_NAME col FROM INFORMATION_SCHEMA.COLUMNS c
  WHERE c.DATA_TYPE IN ('varchar','nvarchar','char','nchar') AND c.TABLE_NAME NOT LIKE 'v\_%' ESCAPE '\\'
    AND EXISTS (SELECT 1 FROM sys.tables tb WHERE tb.name=c.TABLE_NAME)`)) {
  /* 逐列探测代价高,这里只列候选表清单 */
}
const cand = ['dm_ck', 'bs_wh', 'warehouse', 'kucun', 'v_stock_balance', 'v_purchase_in_detail'];
for (const t of cand) {
  const cols = (await q(`SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}'`)).map(r => r.c);
  if (!cols.length) { console.log(`  ${t}: 表不存在`); continue; }
  const hitCols = cols.filter(c => /仓|wh|ck/i.test(c));
  console.log(`  ${t}: 仓库相关列 ${JSON.stringify(hitCols)}`);
}
console.log('\nGBK/其他表里找 半成品仓:');
for (const t of ['kucun']) {
  try { console.log('  kucun 仓库列取值:', JSON.stringify((await q(`SELECT DISTINCT TOP 10 ckdm FROM kucun`)).map(r => r.ckdm))); } catch (e) { console.log('  ', e.message); }
}
await pool.close();
