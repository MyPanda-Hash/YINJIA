import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('=== 所有 doc 面板的 date_col 与 head_table ===');
for (const r of await q("SELECT panel_code, panel_name, head_table, line_table, group_col, date_col FROM yj_panel WHERE mode='doc' ORDER BY panel_code"))
  console.log(`  ${r.panel_code.padEnd(20)} | head=${(r.head_table||'-').padEnd(18)} | grp=${r.group_col} | date=${r.date_col}`);
await pool.close();
