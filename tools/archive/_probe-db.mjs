import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;
for (const t of ['bd_so_order','bl_so_order','bd_pu_order','bl_pu_order']) {
  const total = (await q(`SELECT COUNT(*) n FROM ${t}`))[0].n;
  let synced = '-';
  try { synced = (await q(`SELECT COUNT(*) n FROM ${t} WHERE 外部数据ID IS NOT NULL`))[0].n; } catch(e) { synced = 'no-col'; }
  console.log(`${t}: 总 ${total}, 已同步 ${synced}`);
}
console.log('yj_doc_status SO_ORDER:', (await q("SELECT COUNT(*) n FROM yj_doc_status WHERE panel_code=N'SO_ORDER'"))[0].n);
console.log('yj_doc_status PU_ORDER:', (await q("SELECT COUNT(*) n FROM yj_doc_status WHERE panel_code=N'PU_ORDER'"))[0].n);
await pool.close();
