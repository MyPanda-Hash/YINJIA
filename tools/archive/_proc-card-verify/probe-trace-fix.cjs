/** probe-trace-fix.cjs — Lead 修复后的补验 A/B:
 *   A) POST /api/px/scheduleBoard/trace {工单号, 工单行id} → 200 且检验段有数据
 *   B) POST /api/procCard/trace {卡号} → 工单追溯 不再是 {"错误":…},而是真实结构
 * 用法: node tools/archive/_proc-card-verify/probe-trace-fix.cjs [工单号] [工单行id] [卡号]
 */
const fs = require('node:fs')
const path = require('node:path')
const API = 'http://127.0.0.1:8090'
const OUT = path.join(__dirname, 'trace-fix-result.json')

async function main() {
  const [woArg, rowArg, cardArg] = process.argv.slice(2)
  const login = await (await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const T = login.data.token
  const post = async (p, body) => {
    const r = await fetch(API + p, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${T}` },
      body: Buffer.from(JSON.stringify(body), 'utf8'),
    })
    const text = await r.text()
    let j = null; try { j = JSON.parse(text) } catch {}
    return { http: r.status, json: j, text }
  }

  const res = { ts: new Date().toISOString(), A: {}, B: {} }
  let wo = woArg, rowId = rowArg ? Number(rowArg) : null
  if (!wo) {
    // 从当前卡里取一张(卡头有工单号/工单行id),避免硬编不存在的工单
    const list = await post('/api/procCard/list', { pageNo: 1, pageSize: 5 })
    const row = (list.json?.data?.['行'] || [])[0]
    wo = row?.['工单号']; rowId = row?.['工单行id']
    console.log(`[auto] 用工单 ${wo} 行 ${rowId}(来自 /procCard/list)`)
  }
  console.log(`\n=== A) /api/px/scheduleBoard/trace {工单号:${wo}, 工单行id:${rowId}} ===`)
  const tr = await post('/api/px/scheduleBoard/trace', { 工单号: wo, 工单行id: rowId })
  console.log('HTTP', tr.http, 'code', tr.json?.code, '| message:', (tr.json?.message || '').slice(0, 200))
  const d = tr.json?.data || {}
  console.log('返回 keys:', JSON.stringify(Object.keys(d)))
  const zh = d['头'] || {}
  console.log('头:', JSON.stringify({
    工单号: zh['工单号'] ?? zh['加工单号'] ?? zh['单号'], 产品: zh['产品编码'] ?? zh['产品'], 计划数量: zh['计划数量'],
  }))
  const qc = d['质检数据']
  console.log('质检数据(条数=' + (Array.isArray(qc) ? qc.length : 'N/A') + '):', JSON.stringify(Array.isArray(qc) ? qc.slice(0, 4) : qc))
  const segs = {}
  for (const [k, v] of Object.entries(d)) if (Array.isArray(v)) segs[k] = v.length
  console.log('数组段行数:', JSON.stringify(segs))
  res.A = {
    http: tr.http, code: tr.json?.code, message: tr.json?.message, keys: Object.keys(d),
    头: zh, 质检数据: Array.isArray(qc) ? qc : [], 数组段行数: segs,
    inspectorTypes: Array.isArray(qc) ? [...new Set(qc.map((x) => x['检验类型']))] : [],
  }

  // B) procCard/trace:优先指定卡,否则取列表第一张
  let card = cardArg
  if (!card) {
    const l = await post('/api/procCard/list', { pageNo: 1, pageSize: 5 })
    card = (l.json?.data?.['行'] || [])[0]?.['卡号']
  }
  console.log(`\n=== B) /api/procCard/trace {卡号:${card}} ===`)
  const ct = await post('/api/procCard/trace', { 卡号: card })
  const cd = ct.json?.data || {}
  const woTrace = cd['工单追溯']
  const isErr = !!(woTrace && typeof woTrace === 'object' && ('错误' in woTrace))
  console.log('HTTP', ct.http, 'code', ct.json?.code)
  console.log('trace keys:', JSON.stringify(Object.keys(cd)))
  console.log('工单追溯 是否降级错误:', isErr, isErr ? JSON.stringify(woTrace).slice(0, 200) : '')
  console.log('工单追溯 keys:', JSON.stringify(Object.keys(woTrace || {})))
  const wqc = woTrace?.['质检数据']
  console.log('工单追溯.质检数据 条数:', Array.isArray(wqc) ? wqc.length : 'N/A', JSON.stringify(Array.isArray(wqc) ? wqc.slice(0, 3) : wqc))
  res.B = {
    http: ct.http, code: ct.json?.code, keys: Object.keys(cd), 工单追溯降级: isErr,
    工单追溯keys: Object.keys(woTrace || {}), 工单追溯质检数据: Array.isArray(wqc) ? wqc : [],
  }
  fs.writeFileSync(OUT, JSON.stringify(res, null, 2), 'utf8')
  console.log('\n[json] ' + OUT)
  const ok = res.A.http === 200 && !res.B.工单追溯降级 && res.B.http === 200
  console.log(ok ? '[RESULT] PASS(A 200 + B 无降级错误)' : '[RESULT] FAIL')
  if (!ok) process.exit(1)
}
main().catch((e) => { console.error('[FATAL]', e && e.stack || e); process.exit(2) })
