import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('=== MES 出号规则 s_allno 样本 ===');
for (const r of await q("SELECT TOP 10 comm, dh, lb, ny FROM s_allno ORDER BY id DESC")) console.log('  ' + JSON.stringify(r));
console.log('=== 其他面板单号样本(验证零填充假设) ===');
for (const [t,c] of [['bd_manu_order','合同号'],['wo_order','单据编号'],['bd_material_out','单据编号'],['bd_other_in','单据编号'],['sample_req','单据编号']]) {
  try { const rs = await q(`SELECT TOP 3 [${c}] AS no FROM ${t} ORDER BY [${c}] DESC`); console.log(`  ${t}: ` + rs.map(r=>r.no).join(', ')); } catch(e){ console.log(`  ${t}: ERR ${e.message}`); }
}
await pool.close();
