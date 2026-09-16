import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const run = async (label, sql) => {
  try { const rs = (await new mssql.Request(pool).query(sql)).recordset;
    console.log(`${label} -> ${rs.map(r=>r.__no).join(', ')}`); }
  catch(e) { console.log(`${label} -> FAILED: ${e.message}`); }
};
// bd_manu_order 的 group_col 是 合同号
await run('bd_manu_order(grp=合同号)', `SELECT t.[合同号] AS __no FROM bd_manu_order t WHERE ISNULL(t.asp_cancel,'N')<>'Y' GROUP BY t.[合同号] ORDER BY t.[合同号] DESC OFFSET 0 ROWS FETCH NEXT 4 ROWS ONLY`);
await pool.close();
