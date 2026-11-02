/** 只读探针 ⑫:测试造数残留的完整足迹 + 各问题的处理路径确认 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

const TEST_MATS = ['TEST-MAT-A', 'YJ-GL-047', 'YJ-GL-048', 'YJ-GL-049', 'YJ-ZX-008', 'YJ-ZZ-006']
const IN = TEST_MATS.map((m) => `N'${m}'`).join(',')

line('这 6 个物料在流水里出现的全部单据')
for (const r of await q(`SELECT 'inh' AS t, 单据编号, 单据类型, src, CONVERT(varchar(10),单据日期,120) AS d, 物料编码, 仓库编码, CAST(数量 AS decimal(18,2)) AS qty, asp_user1
                           FROM inh WHERE 物料编码 IN (${IN})
                          UNION ALL
                         SELECT 'outh', 单据编号, 单据类型, src, CONVERT(varchar(10),单据日期,120), 物料编码, 仓库编码, CAST(-数量 AS decimal(18,2)), asp_user1
                           FROM outh WHERE 物料编码 IN (${IN}) ORDER BY 单据编号`))
  console.log(`   [${r.t}] ${String(r.单据编号).padEnd(22)} ${String(r.单据类型).padEnd(10)} src=${r.src} ${r.d} ${String(r.物料编码).padEnd(14)} ${String(r.仓库编码).padEnd(9)} ${String(r.qty).padStart(9)} by=${r.asp_user1}`)

line('这些物料是否还有别的业务痕迹')
for (const r of await q(`SELECT 存货编码, 存货名称, 数据来源, 状态 FROM bs_inv WHERE 存货编码 IN (${IN})`)) console.log('   bs_inv: ' + JSON.stringify(r))
console.log('   bs_inv 中不存在的:' + (await q(`SELECT v FROM (SELECT 1 v) x WHERE NOT EXISTS (SELECT 1 FROM bs_inv WHERE 存货编码='YJ-GL-047')`)).length)

line('kucun 中这 6 个物料的全部行')
for (const r of await q(`SELECT wzdm, ckdm, ISNULL(lot_no,'(null)') AS lot, CAST(rkl AS decimal(18,2)) AS rkl, CAST(ckl AS decimal(18,2)) AS ckl,
                                CAST(yl AS decimal(18,2)) AS yl, asp_user1 FROM kucun WHERE wzdm IN (${IN})`))
  console.log(`   ${String(r.wzdm).padEnd(14)} ${String(r.ckdm).padEnd(9)} lot=${String(r.lot).padEnd(12)} 入=${String(r.rkl).padStart(8)} 出=${String(r.ckl).padStart(8)} 存=${String(r.yl).padStart(9)} by=${r.asp_user1}`)

line('这些物料是否被别的表引用(面板/BOM/采购/工单)')
for (const t of ['bl_purchase_in', 'bd_purchase_in', 'bl_material_out', 'bl_finish_in', 'bl_other_in', 'bd_pu_order', 'bl_pu_order']) {
  try {
    const cols = (await q(`SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}'`)).map((x) => x.c)
    const col = cols.find((c) => /存货编码|材料编码|产品编码/.test(c))
    if (!col) continue
    const n = await q(`SELECT COUNT(*) AS n FROM [${t}] WHERE [${col}] IN (${IN})`)
    if (n[0].n) console.log(`   ${t}.${col}: ${n[0].n} 行`)
  } catch { /* 表不存在 */ }
}

line('TEST-MAT-A 之外的 5 个是否只在月结里')
for (const m of TEST_MATS) {
  const a = await q(`SELECT COUNT(*) AS n FROM inh WHERE 物料编码='${m}' AND 单据类型<>N'月结结转'`)
  const b = await q(`SELECT COUNT(*) AS n FROM outh WHERE 物料编码='${m}'`)
  const c = await q(`SELECT COUNT(*) AS n FROM inh WHERE 物料编码='${m}'`)
  console.log(`   ${m.padEnd(14)} 非月结入库=${a[0].n} 出库=${b[0].n} 全部入库=${c[0].n}`)
}

await pool.close()
