import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const run = async (label, sql) => {
  try { const rs = (await new mssql.Request(pool).query(sql)).recordset;
    console.log(`${label} -> ${rs.map(r=>r.__no).join(', ')}`); }
  catch(e) { console.log(`${label} -> FAILED: ${e.message}`); }
};
console.log('=== 未改动面板(旧口径 GROUP BY 单据编号)回归 ===');
for (const t of ['bd_manu_order','bd_material_out','sample_req','bd_other_in']) {
  await run(`${t.padEnd(16)}`, `SELECT t.[单据编号] AS __no FROM ${t} t WHERE ISNULL(t.asp_cancel,'N')<>'Y' GROUP BY t.[单据编号] ORDER BY t.[单据编号] DESC OFFSET 0 ROWS FETCH NEXT 4 ROWS ONLY`);
}
console.log('=== PU 新口径 ===');
await run('bd_pu_order     ', `SELECT t.[单据编号] AS __no FROM bd_pu_order t WHERE ISNULL(t.asp_cancel,'N')<>'Y' GROUP BY t.[单据编号] ORDER BY MAX(t.asp_time1) DESC, t.[单据编号] DESC OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY`);
await pool.close();
