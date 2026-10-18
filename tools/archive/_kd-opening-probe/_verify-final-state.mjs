/**
 * 服务活体验证(无凭据:只探端口与数据层)
 * ① 8090 是否响应
 * ② 正式库最终状态:期初、kucun、负结存、成本物化表
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

// ① HTTP 探活
try {
  const r = await fetch('http://127.0.0.1:8090/', { method: 'GET' })
  const txt = await r.text()
  console.log(`① 8090 HTTP ${r.status} · 返回 ${txt.length} 字节 · 含 vue 容器=${/id="app"/.test(txt)}`)
} catch (e) {
  console.log('① 8090 响应失败:', e.message)
}

// ② 数据层
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

const a = (await q(`SELECT COUNT(*) AS n, CAST(SUM(yl) AS decimal(18,2)) AS q FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'`))[0]
const b = (await q(`SELECT COUNT(*) AS n FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND yl < 0`))[0]
const c = (await q(`SELECT COUNT(*) AS n, CAST(SUM(数量) AS decimal(18,2)) AS q FROM inh WHERE src = 0 AND 单据编号='INIT-20260831'`))[0]
const d = (await q(`SELECT COUNT(*) AS n FROM inv_cost_ledger`))[0]
const e = (await q(`SELECT COUNT(*) AS n, CAST(ISNULL(SUM(CAST(现存量 AS decimal(18,2))),0) AS decimal(18,2)) AS q FROM v_stock_balance`))[0]

console.log(`\n② 正式库最终状态`)
console.log(`   kucun        ${a.n} 行 / 余量 ${a.q}`)
console.log(`   期初 INIT-20260831  ${c.n} 行 / 数量 ${c.q}`)
console.log(`   批次负结存   ${b.n} 行`)
console.log(`   成本物化表 inv_cost_ledger  ${d.n} 行`)
console.log(`   v_stock_balance  ${e.n} 行 / 现存量 ${e.q}`)

// 关键:按 (物料,仓库) 汇总为负的数量(真缺货)
const f = (await q(`SELECT COUNT(*) AS n FROM (
    SELECT wzdm, ckdm, SUM(yl) AS s FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY wzdm, ckdm
  ) t WHERE s < -0.0001`))[0]
console.log(`   按(物料,仓库)汇总为负的真缺货组合  ${f.n} 个`)
await pool.close()
