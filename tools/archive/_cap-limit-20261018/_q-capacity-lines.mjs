#!/usr/bin/env node
/**
 * _q-capacity-lines.mjs — 桌面「产能对比 · 设置上限」接口取证(2026-10-18)
 *
 * 核对两件事:
 *  1) GET  /api/dashboard/capacity-lines 返回启用产线 + 日产能(正式库只读);
 *  2) 写 + 回读双向:在**测试账套**改一条日产能 → 列表与 /dashboard/capacity 折算的上限都变
 *     → 原值写回。刻意不往正式库写(用户真实账套)。
 *
 * 用法(仓库根): node tools/archive/_cap-limit-20261018/_q-capacity-lines.mjs
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const USER = process.env.YINJIA_UI_USER || 'admin'
const PASS = process.env.YINJIA_UI_PASS || '123456'

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, json: j, text: t }
}
async function req(method, path, token, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, json: j, text: t }
}
const login = async (factory) => {
  const r = await post('/api/auth/login', { userName: USER, password: PASS, factory })
  return r.json?.data?.token || ''
}

let bad = 0
const check = (ok, label, extra = '') => {
  if (!ok) bad++
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${label}${extra ? '  ' + extra : ''}`)
}

// ── 1) 正式库只读 ──
const prodToken = await login('YINJIA-MES')
if (!prodToken) { console.log('[FAIL] 正式库登录失败'); process.exit(1) }
const g1 = await req('GET', '/api/dashboard/capacity-lines', prodToken)
const rows1 = g1.json?.data || []
check(g1.status === 200 && rows1.length > 0, '正式库 GET capacity-lines',
  `HTTP ${g1.status} rows=${rows1.length}`)
check(rows1.every((x) => x.line && Number.isFinite(Number(x.daily))), '每条都有 产线 + 日产能')

// 图表的日上限 == 日产能 × 天数
const capDay = await req('GET', '/api/dashboard/capacity?period=day', prodToken)
const days = Number(capDay.json?.data?.days || 1)
const rowsCap = capDay.json?.data?.rows || []
const byName = new Map(rows1.map((x) => [String(x.line).trim(), Number(x.daily)]))
const limitOk = rowsCap.every((r) => {
  const daily = byName.get(String(r.name).trim())
  if (daily == null) return false
  const expect = Math.round(daily * days)
  return r.limit == null ? daily <= 0 : r.limit === expect
})
check(limitOk, `图表上限与日产能一致(period=day, days=${days})`, `rows=${rowsCap.length}`)

// ── 2) 测试账套:改 → 回读 → 改回 ──
const testToken = await login('YINJIA-MES·测试库')
if (!testToken) { console.log('[WARN] 测试账套登录失败,跳过写回验证'); process.exit(bad ? 2 : 0) }
const gt = await req('GET', '/api/dashboard/capacity-lines', testToken)
const testRows = gt.json?.data || []
if (!testRows.length) {
  console.log('[WARN] 测试账套没有产线,跳过写回验证')
} else {
  const pick = testRows[0]
  const orig = Number(pick.daily)
  const next = orig + 1234
  const put = await req('PUT', '/api/dashboard/capacity-lines', testToken, [{ line: pick.line, daily: next }])
  check(put.status === 200 && Number(put.json?.data?.updated) === 1, '测试账套 PUT 写回', `HTTP ${put.status} updated=${put.json?.data?.updated}`)
  const g2 = await req('GET', '/api/dashboard/capacity-lines', testToken)
  const after = (g2.json?.data || []).find((x) => String(x.line).trim() === String(pick.line).trim())
  check(Number(after?.daily) === next, `回读列表已变(${pick.line})`, `${orig} → ${after?.daily}`)
  const capWeek = await req('GET', '/api/dashboard/capacity?period=week', testToken)
  const wd = Number(capWeek.json?.data?.days || 0)
  const wr = (capWeek.json?.data?.rows || []).find((r) => String(r.name).trim() === String(pick.line).trim())
  check(wd === 7 && wr?.limit === Math.round(next * 7), '周上限 = 日产能 × 7', `limit=${wr?.limit} 期望=${next * 7}`)
  const putBack = await req('PUT', '/api/dashboard/capacity-lines', testToken, [{ line: pick.line, daily: orig }])
  const g3 = await req('GET', '/api/dashboard/capacity-lines', testToken)
  const restored = (g3.json?.data || []).find((x) => String(x.line).trim() === String(pick.line).trim())
  check(Number(putBack.json?.data?.updated) === 1 && Number(restored?.daily) === orig, '原值已写回', `${restored?.daily}`)
}

console.log(bad === 0 ? '[PASS] 产能上限读写与图表折算一致' : `[FAIL] ${bad} 项不符合预期`)
process.exit(bad === 0 ? 0 : 2)
