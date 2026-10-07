/**
 * _dbg-supplement-print.cjs — 直接问服务端:补登打印的三种入参形态各是什么结果(排查用,一次性)
 * 用法:node tools/archive/_dbg-supplement-print.cjs
 */
'use strict'
const { createRequire } = require('node:module')
const mssql = createRequire('D:/jdy-sync/package.json')('mssql')
const API = 'http://127.0.0.1:8090/api'
const DB = 'HSDZ_MES_TEST'
const N = (v) => (v === null || v === undefined ? null : String(v).trim())

async function main() {
  const pool = await new mssql.ConnectionPool({
    server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true },
  }).connect()
  const q = async (s) => (await new mssql.Request(pool).query(s)).recordset
  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token }
  const post = async (u, b) => {
    const j = await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json()
    return j
  }
  const get = async (u) => (await (await fetch(API + u, { headers: H })).json()).data

  // 最近 10 张打印单:看 补登 列的真实取值
  console.log('最近打印单:', JSON.stringify(await q(
    `SELECT TOP 10 h.[单据编号] no, h.[批次号] b, l.[补登] sup, l.[打印数量] q, l.[去向单据] t
     FROM bd_pu_label h JOIN bl_pu_label l ON l.[单据编号]=h.[单据编号]
     ORDER BY h.id DESC`), null, 0))

  // 找一张有"已生单可补打"量的采购订单
  const list = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 })).data?.list || []
  let pick = null
  for (const r of list) {
    if (N(r['单据状态']) !== '已审核') continue
    const no = N(r['单据编号'])
    let d; try { d = await get('/px/puLabel/dialog?orderNo=' + encodeURIComponent(no)) } catch { continue }
    const s = (d?.['补登行'] || []).find((x) => Number(x['可补登数量']) > 0)
    if (s) { pick = { no, s, d }; break }
  }
  if (!pick) { console.log('没有可补登的行,无法试验'); await pool.close(); return }
  console.log('试验对象:', pick.no, JSON.stringify(pick.s))

  for (const [name, flag] of [['布尔 true', true], ['字符串 "Y"', 'Y']]) {
    const before = await get('/px/puLabel/dialog?orderNo=' + encodeURIComponent(pick.no))
    const beforeRow = (before.lines || []).find((x) => Number(x.id) === Number(pick.s['采购订单行id']))
    const res = await post('/px/puLabel/print', {
      orderNo: pick.no, batchNo: '',
      lines: [{ 采购订单行id: pick.s['采购订单行id'], 打印数量: 1, 批次号: pick.s['批次号'], 补登: flag }],
    })
    console.log(`\n--- 入参 补登=${name} ---`)
    console.log('  返回:', JSON.stringify(res).slice(0, 200))
    if (res.code !== 0 && res.code !== 200) continue
    const docNo = res.data['单据编号']
    console.log('  库内行:', JSON.stringify(await q(
      `SELECT [补登] sup, [打印数量] q, [去向单据] t FROM bl_pu_label WHERE [单据编号]=N'${docNo}'`)))
    const after = await get('/px/puLabel/dialog?orderNo=' + encodeURIComponent(pick.no))
    const afterRow = (after.lines || []).find((x) => Number(x.id) === Number(pick.s['采购订单行id']))
    console.log(`  剩余可打 ${beforeRow?.['剩余可打']} → ${afterRow?.['剩余可打']}`)
    const supAfter = (after['补登行'] || []).find((x) => Number(x['采购订单行id']) === Number(pick.s['采购订单行id']))
    console.log(`  该批次 已补打 ${supAfter?.['已补登数量']} / 可补打 ${supAfter?.['可补登数量']}`)
    await post('/px/puLabel/void', { docNo })
  }
  await pool.close()
}
main().catch((e) => { console.error('异常:' + (e && e.stack || e)); process.exit(1) })
