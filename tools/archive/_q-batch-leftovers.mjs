// 一次性探针:P0 前三步成果盘点 + 残留测试单清理清单
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('批次台账全部:', JSON.stringify(await q('SELECT batch_no, batch_seq, batch_qty, status, target_form_no FROM yj_doc_batch ORDER BY id')));
console.log('\n未作废的测试暂收单(批次 YJ-20260916-03-001):');
console.log(JSON.stringify(await q(`SELECT s.单据编号, s.批次号, (SELECT ISNULL(canceled,'N') FROM yj_doc_status x WHERE x.panel_code='SL_RECV' AND x.doc_no=s.单据编号) canceled
  FROM sl_recv s WHERE s.批次号 LIKE 'YJ-20260916-03-%'`)));
console.log('\n未作废的测试入库/退回单:');
console.log(JSON.stringify(await q(`SELECT p.单据编号, p.批次号, (SELECT ISNULL(canceled,'N') FROM yj_doc_status x WHERE x.panel_code='PURCHASE_IN' AND x.doc_no=p.单据编号) canceled
  FROM bd_purchase_in p WHERE p.批次号 LIKE 'YJ-20260916-03-%'`)));
console.log(JSON.stringify(await q(`SELECT r.单据编号, r.批次号, (SELECT ISNULL(canceled,'N') FROM yj_doc_status x WHERE x.panel_code='QC_RETURN' AND x.doc_no=r.单据编号) canceled
  FROM qc_return r WHERE r.批次号 LIKE 'YJ-20260916-03-%'`)));
console.log('\n该批次 ACTIVE 占用:', JSON.stringify(await q("SELECT source_panel_code, target_panel_code, target_form_no, linked_quantity FROM form_flow_link WHERE batch_no='YJ-20260916-03-001' AND link_status='ACTIVE'")));
await pool.close();
