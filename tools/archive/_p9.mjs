import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('=== STOCK_BALANCE 查询字段 ===');
for (const r of await q("SELECT col_name,label,data_type,place FROM yj_field WHERE panel_code='STOCK_BALANCE' AND place LIKE '%query%' ORDER BY seq"))
  console.log(`  ${r.col_name} | ${r.label} | ${r.data_type} | place=${r.place}`);
console.log('=== v_stock_balance 仓库/存货 列存在? ===');
for (const r of await q("SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('v_stock_balance') AND name IN (N'仓库',N'存货',N'期次')"))
  console.log(`  ${r.name}`);
await pool.close();
