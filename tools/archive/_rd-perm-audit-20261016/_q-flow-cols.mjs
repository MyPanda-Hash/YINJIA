import mssql from '../../../deploy/node_modules/mssql/index.js'
const p = await mssql.connect({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password: process.env.YINJIA_SQL_PASS||'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} })
const want = {
  plang: ['scx','rk_no','rk_sl','pl_sl','ja','asp_cancel','pl_date','asp_time2','pl_no','cp_date2'],
  qc_insp: ['单据编号','合格数量','不合格数量','来料检验','特采','审核人','单据状态'],
  qc_insp_detail: ['单据编号','合格数量','不合格数量','特采','结果判断'],
  sl_recv_detail: ['单据编号','来料检验','合格数量','不合格数量','数量','存货编码'],
  qc_return: ['单据编号','特采'],
  qc_return_detail: ['单据编号','特采','退货数量'],
  bl_purchase_in: ['单据编号','是否已转ERP','合格数量'],
  kucun: ['wzdm','ckdm','lot_no','yl','预警数量'],
  form_flow_link: ['source_panel_code','target_panel_code','link_status','linked_quantity'],
}
for (const [t, cols] of Object.entries(want)) {
  const have = (await p.request().query(`SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID(N'dbo.${t}')`)).recordset.map(x=>x.name)
  if (!have.length) { console.log(`${t}: (表不存在)`); continue }
  const hit = cols.filter(c=>have.includes(c)); const miss = cols.filter(c=>!have.includes(c))
  console.log(`${t}: 有[${hit.join(',')}] 缺[${miss.join(',')}]`)
}
await p.close()
