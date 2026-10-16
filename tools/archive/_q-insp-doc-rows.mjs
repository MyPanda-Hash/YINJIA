/*
 * _q-insp-doc-rows.mjs — 找三张检验单里**明细行最多**的单据(给"行多则明细表边框应扩大"做实测样本)
 * 用法: node tools/archive/_q-insp-doc-rows.mjs [数据库名]
 */
import { createRequire } from 'node:module'
const mssql = createRequire('D:/workspace/yinjia/deploy/package.json')('mssql')

const DB = process.argv[2] || 'HSDZ_MES'
const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect()
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset

const cols = await q(`SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME IN ('qc_mold_insp_detail','qc_asm_insp_detail') ORDER BY TABLE_NAME, ORDINAL_POSITION`)
console.log(cols.map((c) => `${c.TABLE_NAME}.${c.COLUMN_NAME}`).join('\n'))

const TABLES = [
  ['QC_MOLD_INSP', 'qc_mold_insp_head', 'qc_mold_insp_detail', '单据编号'],
  ['QC_CUT_INSP', 'qc_cut_insp_head', 'qc_cut_insp_detail', '单据编号'],
  ['QC_ASM_INSP', 'qc_asm_insp_head', 'qc_asm_insp_detail', '单据编号'],
]
for (const [panel, headT, detT, key] of TABLES) {
  let rows = []
  try {
    rows = await q(`SELECT TOP 6 h.[${key}] AS 单号, COUNT(*) AS 行数
    FROM dbo.${detT} d JOIN dbo.${headT} h ON h.[${key}] = d.[${key}]
    WHERE ISNULL(d.asp_cancel,'N') <> 'Y'
    GROUP BY h.[${key}] ORDER BY COUNT(*) DESC`)
  } catch (e) { console.log(`   (${panel} 连接列名不对: ${e.message})`) }
  console.log(`\n${panel}:`)
  for (const r of rows) console.log(`   ${r['单号']}  行数=${r['行数']}`)
}
await pool.close()
