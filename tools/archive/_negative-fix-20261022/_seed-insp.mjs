/** 造一张干净的未审检验单(送检 100 / 合格 60 / 不合格 40),不挂任何下游 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const run = (s) => pool.request().query(s)
const q = async (s) => (await run(s)).recordset

// 取一张真实检验单作模板,复制表头
const tpl = (await q(`SELECT TOP 1 * FROM qc_insp WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC`))[0]
if (!tpl) { console.error('测试库没有可作模板的检验单'); process.exit(1) }
console.log('模板检验单:', tpl.单据编号, '供应商:', tpl.供应商, '批次号:', tpl.批次号)

const NEW = 'IJ-2026-10-TEST01'
await run(`DELETE FROM qc_insp_detail WHERE 单据编号='${NEW}'`)
await run(`DELETE FROM qc_insp WHERE 单据编号='${NEW}'`)

// 复制表头(只换单号/状态)
const cols = Object.keys(tpl).filter((c) => !['id', '单据编号', '单据状态'].includes(c))
const vals = cols.map((c) => {
  const v = tpl[c]
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (typeof v === 'string') return `N'${v.replace(/'/g, "''")}'`
  return 'NULL'
})
await run(`INSERT INTO qc_insp (单据编号, 单据状态, ${cols.join(', ')}) VALUES (N'${NEW}', N'草稿', ${vals.join(', ')})`)

// 明细:引用一个真实物料
const mat = (await q(`SELECT TOP 1 存货编码, 存货名称, 规格型号, 计量单位, 最近采购入库成本 FROM bs_inv
                       WHERE ISNULL(asp_cancel,'N')<>'Y' AND 状态=N'启用' AND ISNULL(最近采购入库成本,0)>0 ORDER BY id DESC`))[0]
console.log('用料:', JSON.stringify(mat))
await run(`INSERT INTO qc_insp_detail (单据编号, 特采, 物料编码, 物料名称, 规格型号, 计量单位, 单位,
            送检数量, 合格数量, 不合格数量, 仓库代码, 单价, 入库单号)
           VALUES (N'${NEW}', 0, N'${mat.存货编码}', N'${mat.存货名称}', N'${mat.规格型号 ?? ''}', N'${mat.计量单位 ?? ''}', N'${mat.计量单位 ?? ''}',
             100, 60, 40, N'恒亿仓', ${Number(mat.最近采购入库成本) || 1}, NULL)`)

// 清掉可能存在的状态行,保证是「未审」
await run(`DELETE FROM yj_doc_status WHERE panel_code='QC_INSP' AND doc_no='${NEW}'`)
await run(`DELETE FROM form_flow_link WHERE source_form_no='${NEW}'`)

for (const r of await q(`SELECT 单据编号, 物料编码, CAST(送检数量 AS decimal(18,2)) 送检, CAST(合格数量 AS decimal(18,2)) 合格,
                                CAST(不合格数量 AS decimal(18,2)) 不合格, ISNULL(入库单号,'-') 入库单号
                           FROM qc_insp_detail WHERE 单据编号='${NEW}'`))
  console.log('已造检验单明细: ' + JSON.stringify(r))
await pool.close()
