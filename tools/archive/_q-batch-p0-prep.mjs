// 一次性探针:P0 落地前确认表结构/字段/配置落点(超送比例存哪、行数量列名、索引现状)
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;

console.log('=== 是否已有"系统参数/配置"表 ===');
console.log(JSON.stringify((await q("SELECT TABLE_NAME t FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%setting%' OR TABLE_NAME LIKE '%config%' OR TABLE_NAME LIKE '%param%' OR TABLE_NAME LIKE 'yj_%' ORDER BY TABLE_NAME")).map(r => r.t)));

console.log('\n=== 采购订单行(bl_pu_order)列 + 样例 ===');
const cols = await q("SELECT COLUMN_NAME c, DATA_TYPE t, CHARACTER_MAXIMUM_LENGTH L FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bl_pu_order' AND (COLUMN_NAME LIKE N'%数量%' OR COLUMN_NAME LIKE N'%行号%' OR COLUMN_NAME LIKE N'%批次%' OR COLUMN_NAME IN (N'物料编码',N'物料名称',N'规格型号',N'单价',N'计量单位',N'单位',N'单据编号')) ORDER BY ORDINAL_POSITION");
console.log(' ', JSON.stringify(cols.map(c => `${c.c}(${c.t}${c.L ? ':' + c.L : ''})`)));
console.log('  样例 3 行:', JSON.stringify((await q("SELECT TOP 3 * FROM bl_pu_order WHERE 单据编号=N'YJ-20260915-08' ORDER BY id")).map(r => ({ id: r.id, 行号: r.行号, 物料: r.物料编码, 数量: r.数量, 单位: r.单位, 计量单位: r.计量单位, 批次号: r.批次号, 是否批次: r.商品是否开启批次 }))));

console.log('\n=== 暂收单(sl_recv / sl_recv_detail)关键列 ===');
console.log('  头:', JSON.stringify((await q("SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='sl_recv' AND (COLUMN_NAME LIKE N'%批次%' OR COLUMN_NAME LIKE N'%订单%' OR COLUMN_NAME LIKE N'%数量%' OR COLUMN_NAME IN (N'单据编号',N'供应商',N'单据日期',N'单据状态'))")).map(r => r.c)));
console.log('  行:', JSON.stringify((await q("SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='sl_recv_detail' AND (COLUMN_NAME LIKE N'%批次%' OR COLUMN_NAME LIKE N'%行号%' OR COLUMN_NAME LIKE N'%数量%' OR COLUMN_NAME IN (N'物料编码',N'计量单位',N'单价'))")).map(r => r.c)));

console.log('\n=== form_flow_link 结构与索引 ===');
console.log(' ', JSON.stringify((await q("SELECT COLUMN_NAME c, DATA_TYPE t FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='form_flow_link' ORDER BY ORDINAL_POSITION")).map(c => `${c.c}:${c.t}`)));
console.log('  索引:', JSON.stringify((await q("SELECT i.name FROM sys.indexes i WHERE i.object_id=OBJECT_ID('form_flow_link') AND i.name IS NOT NULL")).map(r => r.name)));

console.log('\n=== 采购订单 → 暂收 的占用量现状(用于回填脚本设计)===')
console.log(JSON.stringify(await q(`
  SELECT TOP 8 l.source_form_no, l.target_form_no, COUNT(*) lines, SUM(COALESCE(l.linked_quantity,0)) lq,
         (SELECT MIN(asp_time1) FROM sl_recv s WHERE s.单据编号=l.target_form_no) created
  FROM form_flow_link l WHERE l.source_panel_code='PU_ORDER' AND l.target_panel_code='SL_RECV' AND l.link_status='ACTIVE'
  GROUP BY l.source_form_no, l.target_form_no ORDER BY created`), null, 0));
await pool.close();
