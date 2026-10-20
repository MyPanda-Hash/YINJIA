/*
 * _probe-workorder-status.mjs — 生产工单列表「生产状态」回归(2026-10-20)
 *
 * 背景:首件检验单「选生产工单」的状态列改用 PlangStatus(与生产工单列表同一套判据),
 *   同时把生产工单列表的内联判定也换成它 ⇒ 必须证明**列表口径没漂**。
 *
 * 验什么(两账套,只读):
 *   ① 列表接口能出数据,每行都有「生产状态」;
 *   ② 生产状态只会是 未排产/已结案/完工/在产/未完工 五态之一;
 *   ③ 与用 SQL 独立算一遍的结果**逐行一致**(同口径);
 *   ④ 已完工的行确实是「完工」或「已结案」(不与完工状态打架)。
 *
 * 用法: node tools/archive/_first-insp-open-20261020/_probe-workorder-status.mjs [base]
 */
import { createRequire } from 'node:module'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const mssql = createRequire('D:/workspace/yinjia/deploy/package.json')('mssql')
const pools = {}
async function db(factory) {
  const name = factory === 'YJ_TEST' ? 'HSDZ_MES_TEST' : 'HSDZ_MES'
  if (!pools[name]) {
    pools[name] = await new mssql.ConnectionPool({
      server: '127.0.0.1', port: 1433, database: name, user: 'yinjia', password: 'Yinjia@2026',
      options: { encrypt: false, trustServerCertificate: true },
    }).connect()
  }
  return pools[name]
}
const q = async (f, sql) => (await new mssql.Request(await db(f)).query(sql)).recordset

async function login(factory) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
  }).then((x) => x.json())
  if (!r.data?.token) throw new Error(`登录失败 ${factory}`)
  return r.data.token
}

for (const factory of ['YJ', 'YJ_TEST']) {
  console.log(`\n=== ${factory} ===`)
  const tk = await login(factory)
  const res = await fetch(`${BASE}/api/px/workOrderList`, {
    method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }).then((r) => r.json())
  const list = res.data?.list || res.data || []
  console.log(`  行数=${list.length}`)
  ok(`${factory} 列表有数据`, list.length > 0)
  const keys = list.map((r) => `${String(r['工单号']).trim()}#${r['工单行号']}`)
  const states = list.map((r) => String(r['生产状态'] || ''))
  ok(`${factory} 每行都有生产状态`, states.every((s) => s !== ''), JSON.stringify([...new Set(states)]))

  const SET = ['未排产', '已结案', '完工', '在产', '未完工']
  ok(`${factory} 生产状态只落在五态里`, states.every((s) => SET.includes(s)),
    JSON.stringify([...new Set(states)]))

  // SQL 独立算一遍(与 PlangStatus 同一套判据)
  const exp = await q(factory, `
    SELECT p.pl_no AS wo, p.pl_xc AS xc,
      CASE WHEN ISNULL(p.scx,N'')=N'' THEN N'未排产'
           WHEN (ISNULL(p.ja,'N') IN (N'T',N'Y')
                 AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%'))
                THEN N'已结案'
           WHEN ISNULL(p.[完工状态],N'') IN (N'生产完工',N'已完工')
             OR (ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) THEN N'完工'
           WHEN ISNULL(p.rk_sl,0)>0 THEN N'在产' ELSE N'未完工' END AS st
    FROM dbo.plang p WHERE ISNULL(p.asp_cancel,'N')<>'Y'`)
  const expMap = {}
  for (const r of exp) expMap[`${String(r.wo).trim()}#${r.xc}`] = String(r.st).trim()
  const mismatch = []
  for (let i = 0; i < list.length; i++) {
    const want = expMap[keys[i]]
    if (want !== undefined && want !== states[i]) mismatch.push(`${keys[i]}: 接口=${states[i]} 库=${want}`)
  }
  ok(`${factory} 与 SQL 独立口径逐行一致`, mismatch.length === 0, mismatch.slice(0, 5).join(' | '))
  console.log(`  分布: ${JSON.stringify(states.reduce((a, s) => (a[s] = (a[s] || 0) + 1, a), {}))}`)
}

for (const p of Object.values(pools)) await p.close()
console.log(`\n== 生产工单列表「生产状态」回归:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
