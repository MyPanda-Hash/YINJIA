import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password:'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('采购订单号 / 采购订单行号 的 seq(定 批次号 的插入位置):');
for (const r of await q("SELECT panel_code, label, place, seq, id FROM yj_field WHERE label IN (N'采购订单号',N'采购订单行号') ORDER BY panel_code, place, seq")) console.log('  ', JSON.stringify(r));
console.log('\n目标面板现有头字段 seq:');
for (const pc of ['SL_RECV','QC_INSP','QC_RETURN','PURCHASE_IN']) {
  const rows = await q(`SELECT label, seq, place FROM yj_field WHERE panel_code=N'${pc}' AND place LIKE N'%header%' AND seq < 900 ORDER BY seq`);
  console.log(`  ${pc}: ` + rows.map(r => `${r.seq}:${r.label}`).join(' '));
}
console.log('\n目标面板明细字段 seq(末尾 8 个):');
for (const pc of ['SL_RECV','QC_INSP','QC_RETURN','PURCHASE_IN']) {
  const rows = await q(`SELECT label, seq FROM yj_field WHERE panel_code=N'${pc}' AND place LIKE N'%detail%' AND seq < 900 ORDER BY seq`);
  console.log(`  ${pc}: ` + rows.slice(-8).map(r => `${r.seq}:${r.label}`).join(' '));
}
await pool.close();
