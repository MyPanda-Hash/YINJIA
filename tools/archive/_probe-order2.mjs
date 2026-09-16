import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('=== SO 按 asp_time1 DESC 首页10条(期望效果)===');
for (const r of await q("SELECT TOP 10 单据编号, 单据日期, asp_time1 FROM bd_so_order ORDER BY asp_time1 DESC"))
  console.log(`  ${r.单据编号} | ctime=${r.asp_time1?.toISOString?.().slice(0,19)}`);
console.log('=== SO 单号格式分布(前缀形态)===');
for (const r of await q("SELECT TOP 15 LEFT(单据编号,4) AS pfx, COUNT(*) n FROM bd_so_order GROUP BY LEFT(单据编号,4) ORDER BY n DESC"))
  console.log(`  ${r.pfx} -> ${r.n}`);
await pool.close();
