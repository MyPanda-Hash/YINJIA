/** 看金蝶侧有没有这 5 个物料,能否补建 bs_inv 档案 */
import { readFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const MATS = ['YJ-ZZ-006', 'YJ-GL-047', 'YJ-GL-048', 'YJ-GL-049', 'YJ-ZX-008']

console.log('=== 库里这 5 个物料在 bs_inv 的其它形态(改名/停用/作废) ===')
for (const m of MATS)
  for (const r of await q(`SELECT 存货编码, 存货名称, 状态, ISNULL(asp_cancel,'N') c, 数据来源 FROM bs_inv WHERE 存货编码 LIKE '%${m.slice(3)}%' OR 存货名称 IN (N'纸箱', N'PET/PE复合膜')`))
    console.log(`   ${m} ~ ${r.存货编码} ${r.存货名称} 状态=${r.状态} cancel=${r.c}`)

console.log('\n=== bs_inv 里最近新增的物料(看数据来源与时间) ===')
for (const r of await q(`SELECT TOP 5 存货编码, 存货名称, 数据来源, CONVERT(varchar(19),asp_time1,120) t FROM bs_inv ORDER BY asp_time1 DESC`))
  console.log('   ' + JSON.stringify(r))

console.log('\n=== 采购入库单明细里这 5 个物料(单据侧有档案佐证) ===')
for (const r of await q(`SELECT 单据编号, 存货编码, 存货名称, 规格型号, 计量单位, CAST(实收数量 AS decimal(18,2)) q, CAST(单价 AS decimal(18,4)) px, 仓库, 仓库编码, 批号
                           FROM bl_purchase_in WHERE 存货编码 IN (${MATS.map((m) => `N'${m}'`).join(',')})`))
  console.log('   ' + JSON.stringify(r))

console.log('\n=== 材料出库单明细 ===')
for (const r of await q(`SELECT 单据编号, 材料编码, 材料名称, 规格型号, 计量单位, CAST(数量 AS decimal(18,2)) q, 仓库, ISNULL(批号,'(null)') lot
                           FROM bl_material_out WHERE 材料编码 IN (${MATS.map((m) => `N'${m}'`).join(',')})`))
  console.log('   ' + JSON.stringify(r))
await pool.close()

console.log('\n=== 金蝶侧查询 ===')
try {
  const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
  const { token } = await fetchAppToken(cfg)
  for (const m of MATS) {
    const r = await kingdeeTryGet(cfg, token, '/jdy/v2/bd/material', { search: m, page: '1', page_size: '5' })
    const rows = (r.data?.rows || [])
    const hit = rows.find((x) => String(x.number) === m)
    console.log(`   ${m}: ${hit ? `找到 → ${hit.name} / ${hit.model || ''} / ${hit.base_unit_name || ''}` : `金蝶也没查到(返回 ${rows.length} 行)`}`)
  }
} catch (e) { console.log('   金蝶接口不可用: ' + e.message) }
