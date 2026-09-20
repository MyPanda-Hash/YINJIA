import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password:'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
for (const pc of ['SL_RECV','QC_INSP','QC_RETURN','PURCHASE_IN','SALE_OUT','MANU_ORDER']) {
  const p = (await q(`SELECT head_table, line_table FROM yj_panel WHERE panel_code=N'${pc}'`))[0];
  const t = p.head_table || p.line_table;
  const cols = (await q(`SELECT COUNT(*) n FROM sys.columns WHERE object_id=OBJECT_ID('dbo.${t}') AND name LIKE N'附件[1-6]'`))[0].n;
  const flds = (await q(`SELECT COUNT(*) n FROM yj_field WHERE panel_code=N'${pc}' AND data_type=N'附件'`))[0].n;
  console.log(`${pc.padEnd(14)} ${String(t).padEnd(20)} 表附件列=${cols} 字段行=${flds}`);
}
await pool.close();
