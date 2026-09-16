import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();
const sortByTime = (code) => code === 'SO_ORDER' || code === 'PU_ORDER';
function buildPageSql(def, pageNo = 1, pageSize = 6) {
  const g = def.groupCol, docTable = def.headTable;
  const where = "WHERE ISNULL(t.asp_cancel,'N')<>'Y'"
    + " AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = '"+def.code+"' AND s.doc_no = CAST(t.["+g+"] AS nvarchar(100)) AND s.canceled = 'Y')";
  const orderBy = sortByTime(def.code) ? "MAX(t.asp_time1) DESC, t.["+g+"] DESC" : "t.["+g+"] DESC";
  return "SELECT t.["+g+"] AS __no FROM "+docTable+" t "+where+" GROUP BY t.["+g+"] ORDER BY "+orderBy+" OFFSET "+((pageNo-1)*pageSize)+" ROWS FETCH NEXT "+pageSize+" ROWS ONLY";
}
const panels = [
  {code:'SO_ORDER', headTable:'bd_so_order', groupCol:'单据编号'},
  {code:'PU_ORDER', headTable:'bd_pu_order', groupCol:'单据编号'},
  {code:'MANU_ORDER', headTable:'bd_manu_order', groupCol:'合同号'},
  {code:'MATERIAL_OUT', headTable:'bd_material_out', groupCol:'单据编号'},
  {code:'SAMPLE_REQ', headTable:'sample_req', groupCol:'单据编号'},
  {code:'OTHER_IN', headTable:'bd_other_in', groupCol:'单据编号'},
];
for (const p of panels) {
  try { const rs = (await new mssql.Request(pool).query(buildPageSql(p))).recordset;
    console.log(`【${p.code}】${sortByTime(p.code)?'创建时间':'单号(原样)'} -> ${rs.map(r=>r.__no).join(', ') || '(空表)'}`);
  } catch(e) { console.log(`【${p.code}】FAILED: ${e.message}`); }
}
console.log('\n=== SO 分页连续性(第2页) ===');
const rs2 = (await new mssql.Request(pool).query(buildPageSql({code:'SO_ORDER',headTable:'bd_so_order',groupCol:'单据编号'},2,6))).recordset;
console.log('   ' + rs2.map(r=>r.__no).join(', '));
await pool.close();
