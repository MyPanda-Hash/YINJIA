// 一次性探针:验证"待关联字段的存值"能否在目标基础资料里匹配上(名称 vs 编码 的取舍依据)
// 表名/列名全部从 yj_panel / yj_field 元数据取,不猜
import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

const panel = async (pc) => (await q(`SELECT panel_code, panel_name, head_table, line_table FROM yj_panel WHERE panel_code=N'${pc}'`))[0];
const colOf = async (pc, label) => (await q(`SELECT col_name FROM yj_field WHERE panel_code=N'${pc}' AND label=N'${label}'`))[0]?.col_name;
const tableOf = async (pc, place = 'line') => { const p = await panel(pc); return p.head_table || p.line_table; };

// [目标面板, 目标字段标签, 目标表(默认行表), 参照面板, 参照面板里的候选字段标签]
const CASES = [
  ['SL_RECV', '供应商', null, 'GFDA', '供应商名称'],
  ['SL_RECV', '供应商', null, 'GFDA', '供应商编码'],
  ['SL_RECV', '供应商代码', null, 'GFDA', '供应商编码'],
  ['SL_RECV', '业务员', null, 'EMP', '员工名称'],
  ['SL_RECV', '业务员', null, 'YWYDA', '业务员名称'],
  ['QC_INSP', '供应商', null, 'GFDA', '供应商名称'],
  ['QC_RETURN', '供应商', null, 'GFDA', '供应商名称'],
  ['PU_ORDER', '供应商', 'bd_pu_order', 'GFDA', '供应商名称'],
  ['PU_ORDER', '币种', 'bd_pu_order', 'CUR', '名称'],
  ['SO_ORDER', '客户', 'bd_so_order', 'KHDA', '客户名称'],
  ['SO_ORDER', '客户', 'bd_so_order', 'KHDA', '客户编码'],
  ['SO_ORDER', '部门', 'bd_so_order', 'DEPT', '部门名称'],
  ['SO_ORDER', '业务员', 'bd_so_order', 'EMP', '员工名称'],
  ['SALE_OUT', '客户', 'bd_sale_out', 'KHDA', '客户名称'],
  ['SALE_OUT', '结算客户', 'bd_sale_out', 'KHDA', '客户名称'],
  ['SALE_OUT', '经手人', 'bd_sale_out', 'EMP', '员工名称'],
  ['SALE_OUT', '仓库', 'bd_sale_out', 'WH', '仓库名称'],
  ['PURCHASE_IN', '供应商', 'bd_purchase_in', 'GFDA', '供应商名称'],
  ['PURCHASE_IN', '供应商编码', 'bd_purchase_in', 'GFDA', '供应商编码'],
  ['PURCHASE_IN', '仓库', 'bd_purchase_in', 'WH', '仓库名称'],
  ['PURCHASE_IN', '经手人', 'bd_purchase_in', 'EMP', '员工名称'],
];

for (const [pc, label, tOverride, refPanel, refLabel] of CASES) {
  const col = await colOf(pc, label);
  const tbl = tOverride || await tableOf(pc);
  const refCol = await colOf(refPanel, refLabel);
  const refTbl = await tableOf(refPanel);
  if (!col || !refCol || !tbl || !refTbl) { console.log(`  ?? ${pc}.${label} → ${refPanel}.${refLabel} 元数据缺失 col=${col} refCol=${refCol} tbl=${tbl} refTbl=${refTbl}`); continue; }
  const r = (await q(`SELECT COUNT(*) n, SUM(CASE WHEN r.[${refCol}] IS NOT NULL THEN 1 ELSE 0 END) hit FROM (SELECT DISTINCT t.[${col}] v FROM ${tbl} t WHERE t.[${col}] IS NOT NULL AND LTRIM(RTRIM(t.[${col}]))<>'') x LEFT JOIN ${refTbl} r ON r.[${refCol}] = x.v`))[0];
  const miss = await q(`SELECT DISTINCT TOP 2 t.[${col}] v FROM ${tbl} t WHERE t.[${col}] IS NOT NULL AND LTRIM(RTRIM(t.[${col}]))<>'' AND NOT EXISTS (SELECT 1 FROM ${refTbl} r WHERE r.[${refCol}]=t.[${col}])`);
  const flag = r.n > 0 && r.hit === r.n ? 'OK  ' : (r.hit > 0 ? '部分' : '❌  ');
  console.log(`${flag} ${pc}.${label}(${tbl}.${col}) → ${refPanel}.${refLabel}(${refTbl}.${refCol}): 去重 ${r.n} / 命中 ${r.hit}` + (miss.length ? ` 未命中样例 ${JSON.stringify(miss.map(x => x.v))}` : ''));
}
await pool.close();
