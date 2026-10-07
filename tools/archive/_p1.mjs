import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('=== 库存相关面板 ===');
for (const r of await q("SELECT panel_code, panel_name, mode, line_table, head_table, category FROM yj_panel WHERE panel_name LIKE N'%库存%' OR panel_code LIKE '%KUCUN%' OR line_table='kucun' ORDER BY panel_code"))
  console.log(`  ${r.panel_code.padEnd(14)} | ${r.panel_name} | mode=${r.mode} | line=${r.line_table} | head=${r.head_table} | ${r.category}`);
await pool.close();
