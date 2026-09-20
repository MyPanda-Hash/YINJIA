import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password:'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('=== 采购链各表里"批次/批号"相关列 ===');
for (const t of ['bd_pu_order','bl_pu_order','sl_recv','sl_recv_detail','qc_insp','qc_insp_detail','bd_purchase_in','bl_purchase_in','qc_return','qc_return_detail']) {
  const cols = (await q(`SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}' AND (COLUMN_NAME LIKE N'%批次%' OR COLUMN_NAME LIKE N'%批号%' OR COLUMN_NAME LIKE N'%lot%')`)).map(r=>r.c);
  console.log(`  ${t.padEnd(20)} ${JSON.stringify(cols)}`);
}
console.log('\n=== yj_field 里的 批次号/批号 ===');
for (const r of await q("SELECT panel_code, label, col_name, data_type, place FROM yj_field WHERE label LIKE N'%批次%' OR label LIKE N'%批号%' ORDER BY panel_code")) console.log('  ', JSON.stringify(r));
console.log('\n=== 批号流水/登记表 ===');
console.log('  yj_lot_seq:', JSON.stringify(await q('SELECT TOP 3 * FROM yj_lot_seq')));
console.log('  qr_batch_registry:', JSON.stringify((await q('SELECT COUNT(*) n FROM qr_batch_registry'))[0]));
console.log('\n=== form_flow_link 现状(采购链)===');
for (const r of await q("SELECT source_panel_code, target_panel_code, COUNT(*) n, SUM(COALESCE(source_quantity,0)) sq, SUM(COALESCE(linked_quantity,0)) lq FROM form_flow_link GROUP BY source_panel_code, target_panel_code ORDER BY source_panel_code")) console.log('  ', JSON.stringify(r));
console.log('\n=== 一张采购订单多批次?抽查有过暂收的订单 ===');
for (const r of await q("SELECT TOP 5 source_form_no, COUNT(*) links, COUNT(DISTINCT target_form_no) targets FROM form_flow_link WHERE source_panel_code='PU_ORDER' AND target_panel_code='SL_RECV' GROUP BY source_form_no")) console.log('  ', JSON.stringify(r));
await pool.close();
