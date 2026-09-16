import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const run = async (label, sql) => {
  try { const rs = (await new mssql.Request(pool).query(sql)).recordset;
    console.log(`${label}\n   -> ${rs.map(r=>r.__no).join(', ')}\n`); }
  catch(e) { console.log(`${label}\n   FAILED: ${e.message}\n`); }
};
const W = `WHERE ISNULL(t.asp_cancel,'N')<>'Y' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'SO_ORDER' AND s.doc_no = CAST(t.[单据编号] AS nvarchar(100)) AND s.canceled = 'Y')`;
await run('SO 新口径(GROUP BY + MAX(asp_time1) DESC):',
  `SELECT t.[单据编号] AS __no FROM bd_so_order t ${W} GROUP BY t.[单据编号] ORDER BY MAX(t.asp_time1) DESC, t.[单据编号] DESC OFFSET 0 ROWS FETCH NEXT 6 ROWS ONLY`);
await run('SO 旧口径(单据编号 DESC)对照:',
  `SELECT DISTINCT t.[单据编号] AS __no FROM bd_so_order t ${W} ORDER BY t.[单据编号] DESC OFFSET 0 ROWS FETCH NEXT 6 ROWS ONLY`);
try {
  const n = (await new mssql.Request(pool).query(`SELECT COUNT(DISTINCT t.[单据编号]) AS n FROM bd_so_order t ${W}`)).recordset[0].n;
  console.log('SO totalSize =', n);
} catch(e){ console.log('count failed', e.message); }
await pool.close();
