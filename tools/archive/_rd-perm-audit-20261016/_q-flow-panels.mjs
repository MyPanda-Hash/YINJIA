import mssql from '../../../deploy/node_modules/mssql/index.js'
const p = await mssql.connect({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password: process.env.YINJIA_SQL_PASS||'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} })
const codes = ['SO_ORDER','ORDER_CONVERT','WORK_ORDER_LIST','WORK_ORDER_BOARD','MATERIAL_OUT','SCHEDULE_BOARD','PROD_LINE','LINE_LOAD','WO_REPORT','WO_REPORT_LIST','WO_COMPLETION_LIST','QC_PROC_INSP','QC_ASM_INSP','QC_FIRST_INSP','QC_BHG','QC_BHC','FINISH_IN','PU_ORDER','QC_RECV','QC_INSP','QC_INSP_REC','QC_CATALOG','PURCHASE_IN','QC_RETURN','QC_TC_IN','STOCK_DETAIL','STOCK_BALANCE']
const inList = codes.map(c=>`N'${c}'`).join(',')
const r = (await p.request().query(`SELECT panel_code, ISNULL(panel_name,'') pn, ISNULL(mode,'') mode, ISNULL(line_table,'') lt, ISNULL(head_table,'') ht, ISNULL(group_col,'') gc, ISNULL(detail_key,'') dk FROM yj_panel WHERE panel_code IN (${inList}) ORDER BY panel_code`)).recordset
for (const x of r) console.log(`${x.panel_code}\t${x.pn}\tmode=${x.mode}\tline=${x.lt}\thead=${x.ht}\tgroup=${x.gc}\tdetail=${x.dk}`)
console.log('\n--- 不在册的 ---')
const have = new Set(r.map(x=>x.panel_code))
console.log(codes.filter(c=>!have.has(c)).join(', ') || '无')
console.log('\n--- yj_doc_status 列 ---')
console.log((await p.request().query("SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('yj_doc_status') ORDER BY c.column_id")).recordset.map(x=>x.name).join(','))
await p.close()
