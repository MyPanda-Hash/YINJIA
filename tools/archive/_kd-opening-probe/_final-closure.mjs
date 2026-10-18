/**
 * 最终闭环:MES 导入期初(8/31)后,账面能否对上金蝶现存量?
 *
 * 三个对照:
 *  ③a key = (物料, 仓库编码, 批号)  —— kucun 的原生粒度
 *  ③b key = (物料, 仓库编码)         —— 忽略批号
 *  ③c key = (物料)                   —— 忽略仓库与批号
 *
 * 输入:
 *  · 期初 = point_date 2026-08-31(金蝶官方历史时点接口,已验证自洽)
 *  · MES 期间流水 = inh(src 1..8) − outh,单据日期 >= 2026-09-01(这是 MES 实际记的账)
 *  · 目标 = 金蝶现存量(ims)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.env.PROBE_DB || 'HSDZ_MES'
const opening = JSON.parse(readFileSync(new URL('./_out/pointdate-20260831.json', import.meta.url), 'utf8'))
console.log(`期初行 ${opening.length}`)

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

// MES 9/1 后流水
const flow = await q(`
  SELECT wzdm, ckdm, lot, SUM(qty) AS net FROM (
    SELECT RTRIM(物料编码) AS wzdm, ISNULL(RTRIM(仓库编码),N'') AS ckdm, ISNULL(RTRIM(批号),N'') AS lot, 数量 AS qty
      FROM inh WHERE src BETWEEN 1 AND 8 AND ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 >= '2026-09-01'
    UNION ALL
    SELECT RTRIM(物料编码), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N''), -数量
      FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 >= '2026-09-01'
  ) x GROUP BY wzdm, ckdm, lot`)
console.log(`MES 9/1后流水键 ${flow.length}`)

// 金蝶现存量(由 _dump-ims.mjs 事先落盘)
const kdCurrent = JSON.parse(readFileSync(new URL('./_out/ims-current.json', import.meta.url), 'utf8'))

const K3 = (w, c, l) => `${w}|${c}|${l || ''}`
const K2 = (w, c) => `${w}|${c}`
const K1 = (w) => `${w}`

function runCompare(label, kf, keyIms) {
  const sum = (rows, mfn) => {
    const m = new Map()
    for (const r of rows) {
      const k = mfn(r)
      m.set(k, (m.get(k) || 0) + Number(r.qty ?? r.net ?? 0))
    }
    return m
  }
  const op = sum(opening, (r) => kf(r.wzdm, r.ckdm, r.lot))
  const fl = sum(flow, (r) => kf(r.wzdm, r.ckdm, r.lot))
  const im = sum(kdCurrent, (r) => kf(r.wzdm, r.ckdm, r.lot))
  const all = new Set([...op.keys(), ...fl.keys(), ...im.keys()])
  let ok = 0
  const bad = []
  for (const k of all) {
    const calc = (op.get(k) || 0) + (fl.get(k) || 0)
    const target = im.get(k) || 0
    if (Math.abs(calc - target) < 0.0001) ok++
    else bad.push({ k, calc, target, d: calc - target })
  }
  bad.sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
  const absSum = bad.reduce((s, x) => s + Math.abs(x.d), 0)
  console.log(`\n=== ${label} ===`)
  console.log(`  键 ${all.size} · 一致 ${ok} · 不一致 ${bad.length} · |差额|合计 ${absSum.toFixed(2)}`)
  console.log('  差异 TOP8:')
  for (const b of bad.slice(0, 8)) console.log(`    ${b.k.padEnd(42)} 推算=${b.calc.toFixed(2).padStart(12)} 金蝶=${b.target.toFixed(2).padStart(12)} 差=${b.d.toFixed(2).padStart(12)}`)
  return { ok, bad: bad.length, absSum }
}

const r1 = runCompare('③a 键 = 物料 + 仓库 + 批号(kucun 原生粒度)', K3)
const r2 = runCompare('③b 键 = 物料 + 仓库', K2)
const r3 = runCompare('③c 键 = 物料(忽略仓库/批号)', K1)

const totalOp = opening.reduce((s, r) => s + r.qty, 0)
const totalFl = flow.reduce((s, r) => s + Number(r.net), 0)
const totalIm = kdCurrent.reduce((s, r) => s + r.qty, 0)
console.log(`\n=== 合计 ===`)
console.log(`  期初(8/31) ${totalOp.toFixed(2)} + MES 9/1后流水 ${totalFl.toFixed(2)} = ${(totalOp + totalFl).toFixed(2)}`)
console.log(`  金蝶当前现存量 ${totalIm.toFixed(2)}   差 ${(totalOp + totalFl - totalIm).toFixed(2)}`)
await pool.close()
