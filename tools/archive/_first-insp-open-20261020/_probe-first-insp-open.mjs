/*
 * _probe-first-insp-open.mjs — 首件检验单「直接关联生产工单」接口验收(2026-10-20)
 *
 * 用户口径:
 *   「当前是被流程卡死,不完成成型报工就不能产生当前的首件检验单……首件检验单需要关联当前的生产工单
 *    即可,不需要实现成型报工完成流程才产生。就是当前检验单能选取工单,未完工的工单就可以选取,
 *    但是已经完成的就不需要能被选取,已经被当前的检验单选取的也不能被再次选取。」
 *
 * 验什么(接口层,两账套;建单探针只在测试账套跑,跑完删掉):
 *   ① 首件 woLines:门禁不生效(门禁生效=false)、每行都可开单(没有灰行);
 *   ② 首件 woLines 的集合 **恰好等于** 库里「未作废 + 未结案 + 未完工 + 无存活首件单」的行;
 *      且不含任何已完工行、不含任何已有存活首件单的行;
 *   ③ 制程 woLines 回归:门禁仍生效,灰行/可开单口径没被这次改动带坏;
 *   ④ fromWoLine:已完工的工单行被拒(400),未完工的能建单(测试账套),再调一次幂等返回「已存在」。
 *
 * 用法: node tools/archive/_first-insp-open-20261020/_probe-first-insp-open.mjs [base] [--skip-create]
 */
import { createRequire } from 'node:module'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const SKIP_CREATE = process.argv.includes('--skip-create')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
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
const q = async (factory, sql) => (await new mssql.Request(await db(factory)).query(sql)).recordset

async function login(factory) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
  }).then((x) => x.json())
  if (!r.data?.token) throw new Error(`登录失败 ${factory}: ${JSON.stringify(r).slice(0, 200)}`)
  return r.data.token
}
const get = (tk, path) => fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${tk}` } }).then((r) => r.json())
const post = (tk, path, body) => fetch(`${BASE}${path}`, {
  method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}).then((r) => r.json())

/** 库里算出的「应可选」集合(与后端同一份口径,独立写一遍,用来对照) */
async function expected(factory) {
  const rows = await q(factory, `
    SELECT p.pl_no AS wo, p.pl_xc AS xc
    FROM dbo.plang p
    WHERE ISNULL(p.asp_cancel,'N')<>'Y'
      AND NOT (ISNULL(p.ja,'N') IN (N'T',N'Y')
               AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%'))
      AND NOT (ISNULL(p.[完工状态],N'') IN (N'生产完工', N'已完工'))
      AND NOT EXISTS (SELECT 1 FROM dbo.qc_first_insp_head h
                      WHERE h.[工单号]=p.pl_no AND h.[工单行号]=p.pl_xc AND ISNULL(h.asp_cancel,'N')<>'Y')
    ORDER BY p.pl_no, p.pl_xc`)
  return rows.map((r) => `${String(r.wo).trim()}#${r.xc}`)
}

/** 与后端 PlangStatus 同一套判据的生产状态(独立写一遍,用来对照接口下发值) */
async function expectedStatus(factory) {
  const rows = await q(factory, `
    SELECT p.pl_no AS wo, p.pl_xc AS xc,
      CASE WHEN ISNULL(p.scx,N'')=N'' THEN N'未排产'
           WHEN (ISNULL(p.ja,'N') IN (N'T',N'Y')
                 AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%'))
                THEN N'已结案'
           WHEN ISNULL(p.[完工状态],N'') IN (N'生产完工',N'已完工')
             OR (ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) THEN N'完工'
           WHEN ISNULL(p.rk_sl,0)>0 THEN N'在产' ELSE N'未完工' END AS st
    FROM dbo.plang p
    WHERE ISNULL(p.asp_cancel,'N')<>'Y'
      AND NOT (ISNULL(p.ja,'N') IN (N'T',N'Y')
               AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%'))
      AND NOT (ISNULL(p.[完工状态],N'') IN (N'生产完工', N'已完工'))
      AND NOT EXISTS (SELECT 1 FROM dbo.qc_first_insp_head h
                      WHERE h.[工单号]=p.pl_no AND h.[工单行号]=p.pl_xc AND ISNULL(h.asp_cancel,'N')<>'Y')`)
  const m = {}
  for (const r of rows) m[`${String(r.wo).trim()}#${r.xc}`] = String(r.st).trim()
  return m
}
async function completedRows(factory) {
  return (await q(factory, `
    SELECT p.pl_no AS wo, p.pl_xc AS xc FROM dbo.plang p
    WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'') IN (N'生产完工', N'已完工')
    ORDER BY p.pl_no DESC`)).map((r) => `${String(r.wo).trim()}#${r.xc}`)
}
async function pickedRows(factory) {
  return (await q(factory, `
    SELECT DISTINCT h.[工单号] AS wo, h.[工单行号] AS xc FROM dbo.qc_first_insp_head h
    WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND h.[工单号] IS NOT NULL`)).map((r) => `${String(r.wo).trim()}#${r.xc}`)
}

for (const factory of ['YJ', 'YJ_TEST']) {
  console.log(`\n=== ${factory} ===`)
  const tk = await login(factory)
  const res = await get(tk, '/api/qc/firstInsp/woLines?pageNo=1&pageSize=200')
  const list = res.data?.list || []
  const gate = res.data?.gate || {}
  const got = list.map((r) => `${String(r['工单号']).trim()}#${r['工单行号']}`)
  const exp = await expected(factory)
  console.log(`  接口 ${got.length} 行: ${got.join(', ') || '(空)'}`)
  console.log(`  库里应可选 ${exp.length} 行: ${exp.join(', ') || '(空)'}`)
  ok(`${factory} 门禁生效=false`, gate['门禁生效'] === false, JSON.stringify(gate))
  ok(`${factory} 每行都可开单(没有灰行)`, list.every((r) => r['可开单'] === true),
    JSON.stringify(list.filter((r) => r['可开单'] !== true).map((r) => r['工单号'] + '#' + r['工单行号'])))
  // 顺序不比(接口按 工单号 DESC、这里按 ASC 取),只比集合
  const sortedGot = [...got].sort()
  const sortedExp = [...exp].sort()
  ok(`${factory} 集合 = 库里「未完工 + 未被占用 + 未结案」`, JSON.stringify(sortedGot) === JSON.stringify(sortedExp),
    `接口=${JSON.stringify(sortedGot)} 库=${JSON.stringify(sortedExp)}`)
  const done = new Set(await completedRows(factory))
  ok(`${factory} 不含已完工行`, got.every((k) => !done.has(k)), got.filter((k) => done.has(k)).join(','))
  const picked = new Set(await pickedRows(factory))
  ok(`${factory} 不含已有首件单的行`, got.every((k) => !picked.has(k)), got.filter((k) => picked.has(k)).join(','))

  // 生产状态(2026-10-20 追加):与生产工单列表同口径,且本列表里不可能是「完工/已结案」
  const stExp = await expectedStatus(factory)
  const stGot = {}
  for (const r of list) stGot[`${String(r['工单号']).trim()}#${r['工单行号']}`] = String(r['生产状态'] || '')
  const stMismatch = got.filter((k) => stGot[k] !== stExp[k]).map((k) => `${k}: 接口=${stGot[k]} 库=${stExp[k]}`)
  ok(`${factory} 生产状态与生产工单列表同口径`, stMismatch.length === 0, stMismatch.join(' | '))
  ok(`${factory} 生产状态不会是「完工/已结案」`, got.every((k) => !['完工', '已结案'].includes(stGot[k])),
    got.filter((k) => ['完工', '已结案'].includes(stGot[k])).join(','))
  console.log(`  生产状态: ${got.map((k) => `${k}=${stGot[k]}`).join(', ')}`)

  // ③ 制程回归:门禁仍在
  const proc = await get(tk, '/api/qc/procInsp/woLines?pageNo=1&pageSize=200')
  const pGate = proc.data?.gate || {}
  ok(`${factory} 制程门禁仍生效(没被这次改动带坏)`, pGate['门禁生效'] === true, JSON.stringify(pGate))

  // ④ 建单:已完工的行必须被拒
  const doneList = await completedRows(factory)
  if (doneList.length) {
    const [wo, xc] = doneList[0].split('#')
    const r = await post(tk, '/api/qc/firstInsp/fromWoLine', { 工单号: wo, 工单行号: Number(xc) })
    ok(`${factory} 已完工行建单被拒(${doneList[0]})`, r.code === 400 && /已完工/.test(String(r.message || r.msg || '')),
      JSON.stringify(r).slice(0, 200))
  }

  // 未完工的行建单(只在测试账套,跑完删掉)
  if (factory === 'YJ_TEST' && !SKIP_CREATE && exp.length) {
    const [wo, xc] = exp[0].split('#')
    const r1 = await post(tk, '/api/qc/firstInsp/fromWoLine', { 工单号: wo, 工单行号: Number(xc) })
    const no = r1.data?.['编号'] || ''
    ok(`测试账套 未完工行可建单(${exp[0]})`, r1.code === 200 && /^SJ-/.test(no), JSON.stringify(r1).slice(0, 200))
    if (no) {
      const h = (await q(factory, `SELECT ISNULL([工单号],'') wo, ISNULL([工单行号],0) xc,
          ISNULL([产品编码],'') dm FROM dbo.qc_first_insp_head WHERE [单据编号]=N'${no}'`))[0] || {}
      ok('  新单绑了 工单号 + 工单行号', String(h.wo).trim() === wo && Number(h.xc) === Number(xc), JSON.stringify(h))
      // 列表随即不再出现该行
      const after = await get(tk, '/api/qc/firstInsp/woLines?pageNo=1&pageSize=200')
      const afterKeys = (after.data?.list || []).map((x) => `${String(x['工单号']).trim()}#${x['工单行号']}`)
      ok('  建单后该行**不再出现**在可选列表里', !afterKeys.includes(exp[0]), afterKeys.join(','))
      // 再建一次:幂等
      const r2 = await post(tk, '/api/qc/firstInsp/fromWoLine', { 工单号: wo, 工单行号: Number(xc) })
      ok('  重复建单幂等(返回同一张、标记已存在)',
        r2.data?.['编号'] === no && r2.data?.['已存在'] === true, JSON.stringify(r2).slice(0, 200))
      // 清场
      await q(factory, `DELETE FROM dbo.qc_first_insp_detail WHERE [单据编号]=N'${no}';
                        DELETE FROM dbo.qc_first_insp_head WHERE [单据编号]=N'${no}';`)
      console.log(`  清场:删掉探针建的 ${no}`)
    }
  }
}

for (const p of Object.values(pools)) await p.close()
console.log(`\n== 首件检验单直接关联生产工单:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
