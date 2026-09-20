// 一次性探针:挑一张"已审核 + 未入库 + 未送料(无批次)"的采购订单做分批测试
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;

const rows = await q(`
  SELECT TOP 6 o.单据编号, o.关闭状态, o.[入库状态Z部分入库，C全部入库，A未入库] AS 入库状态,
         (SELECT COUNT(*) FROM bl_pu_order d WHERE d.单据编号 = o.单据编号) AS 行数,
         (SELECT SUM(CAST(d.数量 AS decimal(18,4))) FROM bl_pu_order d WHERE d.单据编号 = o.单据编号) AS 数量合计,
         (SELECT COUNT(*) FROM yj_doc_batch b WHERE b.source_form_no = o.单据编号) AS 批次数,
         (SELECT COUNT(*) FROM yj_doc_status s WHERE s.panel_code='PU_ORDER' AND s.doc_no = o.单据编号 AND s.shr IS NOT NULL) AS 已审
  FROM bd_pu_order o
  WHERE ISNULL(o.asp_cancel,'N')<>'Y'
    AND EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='PU_ORDER' AND s.doc_no=o.单据编号 AND s.shr IS NOT NULL AND ISNULL(s.canceled,'N')<>'Y' AND ISNULL(s.stopped,'N')<>'Y')
    AND NOT EXISTS (SELECT 1 FROM yj_doc_batch b WHERE b.source_form_no = o.单据编号)
    AND ISNULL(o.[入库状态Z部分入库，C全部入库，A未入库],'A') = 'A'
  ORDER BY o.asp_time1 DESC`);
console.log(JSON.stringify(rows, null, 1));
await pool.close();
