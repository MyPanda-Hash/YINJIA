/** 判定这 5 个「档案缺失」的物料是不是测试数据 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const MATS = ['YJ-ZZ-006', 'YJ-GL-047', 'YJ-GL-048', 'YJ-GL-049', 'YJ-ZX-008']
const IN = MATS.map((m) => `N'${m}'`).join(',')

console.log('=== 这 5 个物料的全部流水 ===')
for (const r of await q(`SELECT 物料编码, 物料名称, 规格型号, 计量单位 FROM inh WHERE 物料编码 IN (${IN}) GROUP BY 物料编码, 物料名称, 规格型号, 计量单位`))
  console.log(`   ${String(r.物料编码).padEnd(14)} 名称=${String(r.物料名称 ?? '(空)').padEnd(20)} 规格=${r.规格型号 ?? '(空)'} 单位=${r.计量单位 ?? '(空)'}`)

console.log('\n=== 涉及的单据 ===')
for (const r of await q(`SELECT 'inh' t, 单据编号, 单据类型, src, 物料编码, 仓库编码, CONVERT(varchar(10),单据日期,120) d, CAST(数量 AS decimal(18,2)) q, asp_user1
                           FROM inh WHERE 物料编码 IN (${IN}) AND 单据类型<>N'月结结转'
                          UNION ALL
                         SELECT 'outh', 单据编号, 单据类型, src, 物料编码, 仓库编码, CONVERT(varchar(10),单据日期,120), CAST(-数量 AS decimal(18,2)), asp_user1
                           FROM outh WHERE 物料编码 IN (${IN}) ORDER BY 物料编码, t`))
  console.log(`   [${r.t}] ${String(r.单据编号).padEnd(22)} ${String(r.单据类型).padEnd(10)} ${r.物料编码.padEnd(12)} ${String(r.仓库编码).padEnd(9)} ${r.d} ${String(r.q).padStart(9)} by=${r.asp_user1}`)

console.log('\n=== 对照:同前缀的正常物料在不在档案里 ===')
for (const p of ['YJ-GL-045', 'YJ-GL-046', 'YJ-GL-050', 'YJ-ZX-007', 'YJ-ZZ-005', 'YJ-ZZ-007'])
  console.log(`   ${p.padEnd(12)} ${(await q(`SELECT COUNT(*) n FROM bs_inv WHERE 存货编码='${p}'`))[0].n ? '在档案' : '不在'}`)

console.log('\n=== 这 5 个物料是否出现在任何其它单据表 ===')
for (const t of [['bl_purchase_in', '存货编码'], ['bl_material_out', '材料编码'], ['bl_finish_in', '产品编码'], ['bl_other_out', '存货编码'], ['bd_pu_order', null]]) {
  if (!t[1]) continue
  const n = await q(`SELECT COUNT(*) n FROM ${t[0]} WHERE ${t[1]} IN (${IN})`)
  console.log(`   ${t[0]}.${t[1]}: ${n[0].n}`)
}
await pool.close()
