import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('=== yj_panel 列 ===');
console.log((await q("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_panel'")).map(r=>r.COLUMN_NAME).join(', '));
console.log('=== SO_ORDER/PU_ORDER 面板 ===');
for (const r of await q("SELECT * FROM yj_panel WHERE panel_code IN (N'SO_ORDER',N'PU_ORDER')"))
  console.log('  ' + JSON.stringify(r).slice(0, 300));
await pool.close();
