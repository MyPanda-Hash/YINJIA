import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;
console.log('--- bd_so_order (销售订单头) ---');
for (const r of await q("SELECT 单据编号, 客户, 单据日期, 单据状态, asp_user1, 外部数据ID FROM bd_so_order ORDER BY 单据编号")) console.log(`${r.单据编号} | ${r.客户} | ${r.单据日期?.toISOString?.().slice(0,10) ?? r.单据日期} | ${r.单据状态} | user=${r.asp_user1} | ext=${r.外部数据ID}`);
console.log('--- bd_pu_order (采购订单头) ---');
for (const r of await q("SELECT 单据编号, 供应商, 单据日期, 单据状态, asp_user1, 外部数据ID FROM bd_pu_order ORDER BY 单据编号")) console.log(`${r.单据编号} | ${r.供应商} | ${r.单据日期?.toISOString?.().slice(0,10) ?? r.单据日期} | ${r.单据状态} | user=${r.asp_user1} | ext=${r.外部数据ID}`);
await pool.close();
