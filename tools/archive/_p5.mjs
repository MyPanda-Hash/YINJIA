import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const v = await q("SELECT m.definition FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id WHERE o.name='inv_cost_ledger'");
console.log('=== inv_cost_ledger 定义 ===');
console.log(v.length ? v[0].definition : '(是表不是视图)');
if (!v.length) {
  for (const r of await q("SELECT c.name, t.name AS type FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE object_id=OBJECT_ID('inv_cost_ledger') ORDER BY column_id"))
    console.log(`  ${r.name} (${r.type})`);
}
await pool.close();
