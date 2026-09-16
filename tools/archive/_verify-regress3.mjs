import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
// 确认 MANU_ORDER 改动前后顺序完全一致(回归基线)
const oldSql = "SELECT DISTINCT t.[合同号] AS __no FROM bd_manu_order t WHERE ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.[合同号] DESC OFFSET 0 ROWS FETCH NEXT 8 ROWS ONLY";
const newSql = "SELECT t.[合同号] AS __no FROM bd_manu_order t WHERE ISNULL(t.asp_cancel,'N')<>'Y' GROUP BY t.[合同号] ORDER BY t.[合同号] DESC OFFSET 0 ROWS FETCH NEXT 8 ROWS ONLY";
const a = (await new mssql.Request(pool).query(oldSql)).recordset.map(r=>r.__no);
const b = (await new mssql.Request(pool).query(newSql)).recordset.map(r=>r.__no);
console.log('MANU_ORDER 旧:', a.join(', '));
console.log('MANU_ORDER 新:', b.join(', '));
console.log('顺序一致:', JSON.stringify(a)===JSON.stringify(b) ? 'YES ✓' : 'NO ✗');
await pool.close();
