// 一次性探针:再核一批字段的存值域(部门/客户编码/币种/检验员/退货原因…),确认 ref_field 该取名称还是编码
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;
const colOf = async (pc, label) => (await q(`SELECT col_name FROM yj_field WHERE panel_code=N'${pc}' AND label=N'${label}'`))[0]?.col_name;
const tblOf = async (pc) => { const p = (await q(`SELECT head_table, line_table FROM yj_panel WHERE panel_code=N'${pc}'`))[0]; return p?.head_table || p?.line_table; };

async function hit(tag, pc, label, refPanel, refLabel, useDetailTable) {
  const col = await colOf(pc, label);
  let tbl = await tblOf(pc);
  if (useDetailTable) tbl = (await q(`SELECT line_table FROM yj_panel WHERE panel_code=N'${pc}'`))[0]?.line_table;
  const refCol = await colOf(refPanel, refLabel);
  const refTbl = await tblOf(refPanel);
  if (!col || !refCol) return console.log(`  ?? ${tag}: 元数据缺失 col=${col} refCol=${refCol}(${refPanel}.${refLabel})`);
  const vals = async (t, c) => (await q(`SELECT DISTINCT TOP 6 [${c}] v FROM ${t} WHERE [${c}] IS NOT NULL AND LTRIM(RTRIM([${c}]))<>''`)).map(x => x.v);
  const r = (await q(`SELECT COUNT(*) n, SUM(CASE WHEN r.[${refCol}] IS NOT NULL THEN 1 ELSE 0 END) hit FROM (SELECT DISTINCT t.[${col}] v FROM ${tbl} t WHERE t.[${col}] IS NOT NULL AND LTRIM(RTRIM(t.[${col}]))<>'') x LEFT JOIN ${refTbl} r ON r.[${refCol}] = x.v`))[0];
  console.log(`  ${pc}.${label}(${tbl}.${col}) → ${refPanel}.${refLabel}: 去重 ${r.n} 命中 ${r.hit} | 取值样例 ${JSON.stringify(await vals(tbl, col))}`);
}

console.log('=== 部门 ===');
await hit('', 'PURCHASE_IN', '部门', 'DEPT', '部门名称');
await hit('', 'PURCHASE_IN', '部门编码', 'DEPT', '部门编码');
await hit('', 'SO_ORDER', '部门', 'DEPT', '部门名称');
await hit('', 'SL_RECV', '部门', 'DEPT', '部门名称');
console.log('=== 客户编码 / 结算客户 / 币种 ===');
await hit('', 'SO_ORDER', '客户编码', 'KHDA', '客户编码');
await hit('', 'SO_ORDER', '结算客户', 'KHDA', '客户名称');
await hit('', 'SO_ORDER', '币种', 'CUR', '名称');
await hit('', 'SALE_OUT', '客户编码', 'KHDA', '客户编码');
await hit('', 'SALE_OUT', '客户编码', 'KHDA', '客户名称');
console.log('=== 检验员 / 经手人 ===');
await hit('', 'QC_INSP', '检验员', 'EMP', '员工名称');
await hit('', 'QC_RETURN', '经手人', 'EMP', '员工名称');
console.log('=== 退货原因(退回单 vs 不合格原因档案)===')
const rejCols = (await q("SELECT label, col_name FROM yj_field WHERE panel_code='REJECT'")).map(r => `${r.label}[${r.col_name}]`);
console.log('  REJECT 面板字段:', JSON.stringify(rejCols));
console.log('  qc_return.退货原因 取值:', JSON.stringify((await q("SELECT DISTINCT TOP 8 退货原因 v FROM qc_return WHERE ISNULL(退货原因,'')<>''")).map(r => r.v)));
console.log('  bd_sale_out.退货原因 取值:', JSON.stringify((await q("SELECT DISTINCT TOP 8 退货原因 v FROM bd_sale_out WHERE ISNULL(退货原因,'')<>''")).map(r => r.v)));
console.log('=== 物料编码(明细)存值 ===');
for (const [t, c] of [['sl_recv_detail', '物料编码'], ['qc_insp_detail', '物料编码'], ['qc_return_detail', '物料编码']]) {
  try { console.log(`  ${t}.${c}:`, JSON.stringify((await q(`SELECT DISTINCT TOP 4 [${c}] v FROM ${t}`)).map(x => x.v))); } catch (e) { console.log(`  ${t}: ${e.message}`); }
}
console.log('=== WH 仓库名称全量 ===');
console.log(' ', JSON.stringify((await q('SELECT 仓库编码, 仓库名称 FROM bs_wh')).map(r => `${r.仓库编码}=${r.仓库名称}`)));
await pool.close();
