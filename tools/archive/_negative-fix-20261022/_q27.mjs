/** 精确查这 5 个物料:金蝶有没有、单据明细侧有没有名称规格 */
import { readFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const MATS = ['YJ-ZZ-006', 'YJ-GL-047', 'YJ-GL-048', 'YJ-GL-049', 'YJ-ZX-008']

console.log('=== bs_inv 精确查(含已作废/停用) ===')
for (const m of MATS) {
  const r = await q(`SELECT 存货编码, 存货名称, 状态, ISNULL(asp_cancel,'N') c FROM bs_inv WHERE 存货编码 = N'${m}'`)
  console.log(`   ${m.padEnd(12)} ${r.length ? JSON.stringify(r[0]) : '不存在'}`)
}

console.log('\n=== 采购入库明细(单据侧档案佐证) ===')
for (const r of await q(`SELECT 单据编号, 存货编码, 存货名称, 规格型号, 计量单位, CAST(实收数量 AS decimal(18,2)) q,
                                CAST(单价 AS decimal(18,4)) px, 仓库, 仓库编码, ISNULL(批号,'(null)') lot
                           FROM bl_purchase_in WHERE 存货编码 IN (${MATS.map((m) => `N'${m}'`).join(',')})`))
  console.log('   ' + JSON.stringify(r))

console.log('\n=== 材料出库明细 ===')
for (const r of await q(`SELECT 单据编号, 材料编码, 材料名称, 规格型号, 计量单位, CAST(数量 AS decimal(18,2)) q, 仓库, ISNULL(批号,'(null)') lot
                           FROM bl_material_out WHERE 材料编码 IN (${MATS.map((m) => `N'${m}'`).join(',')})`))
  console.log('   ' + JSON.stringify(r))
await pool.close()

console.log('\n=== 金蝶物料接口 ===')
try {
  const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
  const { token } = await fetchAppToken(cfg)
  for (const m of MATS) {
    const r = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/material', { search: m, page: '1', page_size: '20' })
    const rows = (r.data?.rows || [])
    const hit = rows.find((x) => String(x.number) === m)
    console.log(`   ${m.padEnd(12)} ${hit ? `✔ 金蝶有:${hit.name} / ${hit.model || ''} / ${hit.base_unit_name || ''}` : `✗ 金蝶无(搜索返回 ${rows.length} 行)`}`)
  }
} catch (e) { console.log('   金蝶接口不可用: ' + e.message) }
