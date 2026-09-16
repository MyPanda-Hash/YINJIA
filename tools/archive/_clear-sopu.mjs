import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const tx = new mssql.Transaction(pool);
await tx.begin();
try {
  const r = new mssql.Request(tx);
  await r.batch(`
    DELETE FROM bl_so_order;
    DELETE FROM bl_pu_order;
    DELETE FROM yj_doc_status WHERE panel_code IN (N'SO_ORDER', N'PU_ORDER');
    DELETE FROM bd_so_order;
    DELETE FROM bd_pu_order;`);
  await tx.commit();
  console.log('已清除(单事务提交)');
} catch (e) { await tx.rollback(); console.error('回滚:', e.message); process.exit(1); }
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset[0].n;
for (const t of ['bd_so_order','bl_so_order','bd_pu_order','bl_pu_order'])
  console.log(`${t}: ${await q(`SELECT COUNT(*) n FROM ${t}`)}`);
console.log(`yj_doc_status SO_ORDER: ${await q("SELECT COUNT(*) n FROM yj_doc_status WHERE panel_code=N'SO_ORDER'")}`);
console.log(`yj_doc_status PU_ORDER: ${await q("SELECT COUNT(*) n FROM yj_doc_status WHERE panel_code=N'PU_ORDER'")}`);
await pool.close();
