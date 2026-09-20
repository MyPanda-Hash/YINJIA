// 一次性探针:批次台账索引与内容
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
console.log('索引:', JSON.stringify(await q("SELECT name, is_unique, has_filter, filter_definition FROM sys.indexes WHERE object_id=OBJECT_ID('yj_doc_batch') AND name IS NOT NULL")));
console.log('台账行:', JSON.stringify(await q('SELECT batch_no, batch_seq, batch_qty, status, target_form_no FROM yj_doc_batch ORDER BY batch_seq')));
console.log('暂收单批次号:', JSON.stringify(await q("SELECT 单据编号, 批次号, 采购订单号, 单据状态 FROM sl_recv ORDER BY 单据编号")));
console.log('检验单批次号:', JSON.stringify(await q("SELECT 单据编号, 批次号, 采购订单号, 暂收单号 FROM qc_insp ORDER BY 单据编号")));
console.log('入库单批次号:', JSON.stringify(await q("SELECT 单据编号, 批次号 FROM bd_purchase_in WHERE ISNULL(批次号,'')<>''")));
console.log('退回单批次号:', JSON.stringify(await q("SELECT 单据编号, 批次号, 检验单号 FROM qc_return")));
await pool.close();
