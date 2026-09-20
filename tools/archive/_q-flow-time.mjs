// 一次性探针:①订单表"最后修改时间"是否被同步批量刷新 ②流转关联表是否带时间戳(备"最近流转优先"排序选项)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

for (const [t, c] of [['bd_pu_order', '修改时间'], ['bd_so_order', '修改时间']]) {
  const cols = (await q(`SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}'`)).map(r => r.c);
  if (!cols.includes(c)) { console.log(`${t}: 无「${c}」列`); continue; }
  const r = (await q(`SELECT COUNT(*) n, COUNT(DISTINCT [${c}]) d, MIN([${c}]) mn, MAX([${c}]) mx FROM ${t}`))[0];
  console.log(`${t}: 行数 ${r.n}, 「${c}」不同值 ${r.d}, 区间 ${r.mn} ~ ${r.mx}`);
  const top = await q(`SELECT TOP 6 [单据编号],[${c}],[创建时间] FROM ${t} ORDER BY [${c}] DESC`);
  console.log('   按修改时间倒序前 6:', JSON.stringify(top));
}
const ff = (await q("SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='form_flow_link' ORDER BY ORDINAL_POSITION")).map(r => r.c);
console.log('\nform_flow_link 列:', JSON.stringify(ff));
await pool.close();
