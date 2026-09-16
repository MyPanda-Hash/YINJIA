// 复刻 QueryService 修改后的 pageSql 构造逻辑,对真实库执行,验证两个面板 + 回归面板
import mssql from 'mssql';
const pool = await new mssql.ConnectionPool({server:'127.0.0.1',port:1433,database:'HSDZ_MES',user:'yinjia',password:'Yinjia@2026',options:{encrypt:false,trustServerCertificate:true}}).connect();

const sortByTime = (code) => code === 'SO_ORDER' || code === 'PU_ORDER';
function buildPageSql(def, pageNo = 1, pageSize = 6) {
  const g = def.groupCol;
  const docTable = def.headTable;
  const where = "WHERE ISNULL(t.asp_cancel,'N')<>'Y'"
    + " AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = '"+def.code+"' AND s.doc_no = CAST(t.["+g+"] AS nvarchar(100)) AND s.canceled = 'Y')";
  const keyCol = sortByTime(def.code) ? "MAX(t.asp_time1)" : "t.[" + g + "]";
  return "SELECT t.[" + g + "] AS __no FROM " + docTable + " t " + where
    + " GROUP BY t.[" + g + "]"
    + " ORDER BY " + keyCol + " DESC, t.[" + g + "] DESC"
    + " OFFSET " + ((pageNo-1)*pageSize) + " ROWS FETCH NEXT " + pageSize + " ROWS ONLY";
}
const panels = [
  {code:'SO_ORDER', headTable:'bd_so_order', groupCol:'单据编号'},
  {code:'PU_ORDER', headTable:'bd_pu_order', groupCol:'单据编号'},
  {code:'MANU_ORDER', headTable:'bd_manu_order', groupCol:'合同号'},
  {code:'MATERIAL_OUT', headTable:'bd_material_out', groupCol:'单据编号'},
];
for (const p of panels) {
  const sql = buildPageSql(p);
  try {
    const rs = (await new mssql.Request(pool).query(sql)).recordset;
    const mode = sortByTime(p.code) ? '创建时间' : '单号(原样)';
    console.log(`【${p.code}】排序依据=${mode}\n   ${rs.map(r=>r.__no).join(', ')}`);
  } catch(e) { console.log(`【${p.code}】FAILED: ${e.message}`); }
}
await pool.close();
