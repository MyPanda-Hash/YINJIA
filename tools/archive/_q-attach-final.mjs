import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password:'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('遗留测试附件:', JSON.stringify(await q("SELECT id, panel_code, doc_no, file_name FROM yj_attachment WHERE file_name LIKE N'订单附件测试%'")));
console.log('yj_attachment 全表:', JSON.stringify(await q('SELECT id, panel_code, doc_no, field_key, file_name FROM yj_attachment')));
console.log('列注释(每表附件1):', JSON.stringify(await q(`
  SELECT t.name tbl, c.name col, CAST(ep.value AS nvarchar(120)) d
  FROM sys.extended_properties ep
  JOIN sys.tables t ON t.object_id = ep.major_id
  JOIN sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
  WHERE ep.name='MS_Description' AND c.name=N'附件1' ORDER BY t.name`)));
console.log('译名统计:', JSON.stringify(await q("SELECT ref_key, COUNT(*) n FROM yj_translation WHERE scope='field' AND ref_key LIKE N'附件%' GROUP BY ref_key ORDER BY ref_key")));
console.log('en 译名:', JSON.stringify(await q("SELECT ref_key, text FROM yj_translation WHERE scope='field' AND locale='en' AND ref_key LIKE N'附件%' ORDER BY ref_key")));
await pool.close();
