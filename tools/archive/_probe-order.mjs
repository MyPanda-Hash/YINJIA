import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('=== SO_ORDER 按 单据编号 DESC 的首页10条(MES 当前显示顺序)===');
for (const r of await q("SELECT TOP 10 单据编号, 单据日期, 客户, asp_time1 FROM bd_so_order ORDER BY 单据编号 DESC"))
  console.log(`  ${r.单据编号} | 日期=${r.单据日期?.toISOString?.().slice(0,10)} | ${r.客户} | ctime=${r.asp_time1?.toISOString?.().slice(0,19)}`);
console.log('=== PU_ORDER 按 单据编号 DESC 的首页10条 ===');
for (const r of await q("SELECT TOP 10 单据编号, 单据日期, 供应商, asp_time1 FROM bd_pu_order ORDER BY 单据编号 DESC"))
  console.log(`  ${r.单据编号} | 日期=${r.单据日期?.toISOString?.().slice(0,10)} | ${r.供应商} | ctime=${r.asp_time1?.toISOString?.().slice(0,19)}`);
await pool.close();
