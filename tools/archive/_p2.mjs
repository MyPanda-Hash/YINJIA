import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('=== v_stock_ledger 视图定义 ===');
const v = await q("SELECT m.definition FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id WHERE o.name='v_stock_ledger'");
console.log(v[0].definition);
console.log('=== STOCK_LEDGER 面板字段(仓库相关)===');
for (const r of await q("SELECT col_name,label,data_type,dict_sql,ref_panel,ref_field,display_field,place,seq FROM yj_field WHERE panel_code='STOCK_LEDGER' ORDER BY seq"))
  console.log(`  seq=${String(r.seq).padStart(3)} | ${r.col_name.padEnd(16)} | ${r.label.padEnd(10)} | ${r.data_type.padEnd(6)} | dict=${(r.dict_sql||'-').slice(0,70)} | ref=${r.ref_panel||'-'}.${r.ref_field||''}->${r.display_field||''} | place=${r.place}`);
await pool.close();
