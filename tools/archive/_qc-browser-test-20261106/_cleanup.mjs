// egolite 走查测试数据的物理清理(仅测试账套 HSDZ_MES_TEST + 单号白名单闸门)
// 覆盖:头/明细/yj_doc_status/yj_form_approval/yj_message
import { createRequire } from 'node:module';
const r = createRequire('D:/workspace/yinjia/tests/e2e/');
const sql = r('mssql');
const DOCS = ['ZC-2026-11-0021', 'ZC-2026-11-0022'];
const pool = await new sql.ConnectionPool({
  server: '127.0.0.1', port: 1433, user: 'yinjia', password: 'Yinjia@2026', database: 'HSDZ_MES_TEST',
  options: { encrypt: false, trustServerCertificate: true },
}).connect();
const db = String((await pool.request().query('SELECT DB_NAME() db')).recordset[0].db).trim();
if (db !== 'HSDZ_MES_TEST') { console.error('REFUSED: not on HSDZ_MES_TEST'); process.exit(1); }
for (const no of DOCS) {
  for (const [t, c] of [['yj_form_approval','form_no'],['yj_message','单据编号'],['yj_doc_status','doc_no'],['qc_proc_insp_detail','单据编号'],['qc_proc_insp_head','单据编号']]) {
    const res = await pool.request().input('no', no).query(`DELETE FROM [${t}] WHERE [${c}] = @no`);
    console.log(`[DELETE] ${t}.${c} ${no} -> ${res.rowsAffected[0]} 行`);
  }
}
const chk = await pool.request().query(`
  SELECT (SELECT COUNT(*) FROM qc_proc_insp_head WHERE 单据编号 LIKE 'ZC-2026-11-00%') head,
         (SELECT COUNT(*) FROM qc_proc_insp_detail WHERE 单据编号 LIKE 'ZC-2026-11-00%') detail,
         (SELECT COUNT(*) FROM yj_doc_status WHERE doc_no LIKE 'ZC-2026-11-00%' AND panel_code='QC_PROC_INSP') status,
         (SELECT COUNT(*) FROM yj_form_approval WHERE form_no LIKE 'ZC-2026-11-00%' AND panel_code='QC_PROC_INSP') approval,
         (SELECT COUNT(*) FROM yj_message WHERE 单据编号 LIKE 'ZC-2026-11-00%') msg`);
console.log('清理后复核 =', JSON.stringify(chk.recordset[0]));
await pool.close();
