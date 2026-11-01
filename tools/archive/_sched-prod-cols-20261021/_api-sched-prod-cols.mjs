/**
 * _api-sched-prod-cols.mjs — 「快速排产已排产列表补产品/规格型号」接口探针(2026-10-21)
 *
 * 口径(用户 2026-10-21):「快速排产看不到已排单的型号,当前需要增加对应的产品还有规格型号需要增加」
 *   ⇒ /api/px/scheduleBoard/today(mode=all / today)每一行必须带 产品编号 / 品名 / 型号,
 *     且值与 plang(工单行)里的产品一致;关键字按型号/产品编号也能命中。
 *
 * 只读:只登录 + 查列表,不写任何单据(正式账套 YINJIA 也安全)。
 * 用法(仓库根):node tools/archive/_sched-prod-cols-20261021/_api-sched-prod-cols.mjs
 *   MES_BASE 可覆盖默认 http://127.0.0.1:8090
 */
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'

let pass = 0, fail = 0
function ok(cond, msg) {
  if (cond) { pass++; console.log(`  [PASS] ${msg}`) }
  else { fail++; console.log(`  [FAIL] ${msg}`) }
}

async function login(factory) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
  })
  const j = await r.json()
  if (!j?.data?.token) throw new Error('登录失败: ' + JSON.stringify(j).slice(0, 200))
  return j.data.token
}

async function api(token, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* 非 JSON 原样返回 */ }
  return { status: r.status, json, text }
}

const token = await login('YINJIA')
console.log('登录 OK(factory=YINJIA ⇒ 正式账套,只读)')

console.log('\n[1] mode=all:已排产行必须带 产品编号/品名/型号')
const all = await api(token, '/api/px/scheduleBoard/today', { mode: 'all', keyword: '' })
ok(all.status === 200, `HTTP 200(实际 ${all.status})`)
const rows = all.json?.data || []
console.log(`  [INFO] 行数 = ${rows.length}`)
if (rows.length) {
  const keys = Object.keys(rows[0])
  for (const k of ['产品编号', '品名', '型号']) ok(keys.includes(k), `返回行含字段「${k}」`)
  console.log('  [INFO] 首行:', JSON.stringify({
    生产线: rows[0]['生产线'], 加工单号: rows[0]['加工单号'], 工单行号: rows[0]['工单行号'],
    产品编号: rows[0]['产品编号'], 品名: rows[0]['品名'], 型号: rows[0]['型号'], 生产状态: rows[0]['生产状态'],
  }))
  ok(rows.every((r) => r['产品编号'] !== undefined && r['品名'] !== undefined && r['型号'] !== undefined),
    '每一行都带三个新字段(不是只首行)')
  ok(rows.some((r) => String(r['产品编号'] || '') !== '' && String(r['型号'] || '') !== ''),
    '至少有一行同时有 产品编号 与 型号(列不是全空)')
}

console.log('\n[2] 关键字按型号命中(取首行型号片段)')
const sample = rows.find((r) => String(r['型号'] || '').length >= 4)
if (sample) {
  const frag = String(sample['型号']).slice(0, 6)
  const byGg = await api(token, '/api/px/scheduleBoard/today', { mode: 'all', keyword: frag })
  const hit = byGg.json?.data || []
  ok(hit.length > 0, `型号片段「${frag}」能查到行(${hit.length} 行)`)
  ok(hit.every((r) => [r['加工单号'], r['品名'], r['型号'], r['产品编号'], r['生产线'], r['批次号']]
    .some((v) => String(v || '').includes(frag))), '命中的每一行确实含该片段(不是全表放行)')
  const byDm = await api(token, '/api/px/scheduleBoard/today', { mode: 'all', keyword: String(sample['产品编号']) })
  const hit2 = byDm.json?.data || []
  ok(hit2.some((r) => String(r['产品编号']) === String(sample['产品编号'])), '产品编号仍能命中(老口径未被破坏)')
} else {
  console.log('  [SKIP] 没有带型号的已排产行,跳过关键字用例')
}

console.log('\n[3] mode=today 与 pending 不受影响')
const td = await api(token, '/api/px/scheduleBoard/today', { mode: 'today', keyword: '' })
ok(td.status === 200, `today 模式 HTTP 200(实际 ${td.status},${(td.json?.data || []).length} 行)`)
const pending = await api(token, '/api/px/scheduleBoard/pending', { keyword: '' })
ok(pending.status === 200, `待排产池 HTTP 200(实际 ${pending.status},${(pending.json?.data || []).length} 行)`)
const p0 = (pending.json?.data || [])[0]
if (p0) ok(['产品编号', '品名', '型号'].every((k) => k in p0), '待排产池三个字段仍在(未被本次改动挤掉)')

console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`)
process.exit(fail ? 1 : 0)
