/**
 * 端到端验证(2026-11-12):「转ERP 点两下 = 只推一次」。
 *
 * 做法:同一张单**同时**发两个 /api/px/callButton 请求(模拟双击 / 两个标签页 / 两台电脑),
 * 期望:一个请求真正去推金蝶(成功或金蝶侧报错都算"只推了一次"),另一个**立刻**被
 * KingdeePushService 的单号级互斥拒掉(提示「该单据正在转ERP推送中…」)。
 * 绝不能出现"两个请求都进到金蝶"(那就是客户看到的重复入库)。
 *
 * ⚠ 本脚本会**真的**向当前 kingdee.push 配置指向的账套推一张单(本机配置 = 测试沙箱)。
 *   故默认只挑测试单(TCGRK-*),绝不碰真实业务单;单据号请用命令行传第三个参数覆盖。
 *
 * 用法(仓库根):
 *   node tools/archive/_erp-speed-20261112/e2e-concurrent.mjs [panelCode] [docNo]
 *   默认 PURCHASE_IN + TCGRK-0049
 */
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const PANEL = process.argv[2] || 'PURCHASE_IN'
const DOC = process.argv[3] || 'TCGRK-0049'

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login?.data?.token
if (!token) throw new Error('登录失败:' + JSON.stringify(login).slice(0, 300))
console.log(`已登录(${BASE}),目标单据 = ${PANEL} / ${DOC}`)

const call = async (tag) => {
  const t0 = Date.now()
  try {
    const r = await fetch(`${BASE}/api/px/callButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ panelCode: PANEL, buttonName: '转ERP', formData: { 编号: DOC, 单据编号: DOC }, buttonParam: {} }),
    })
    const text = await r.text()
    return { tag, ms: Date.now() - t0, status: r.status, text }
  } catch (e) {
    return { tag, ms: Date.now() - t0, status: 0, text: 'ERR ' + e.message }
  }
}

// 两个请求同时放出(不 await 第一个)—— 这就是"点两下"的真实时序
const results = await Promise.all([call('A'), call('B')])
let pushed = 0, rejected = 0
for (const r of results) {
  const busy = r.text.includes('正在转ERP推送中')
  if (busy) rejected++
  else pushed++
  console.log(`\n[${r.tag}] ${r.ms}ms HTTP ${r.status} ${busy ? '→ 被互斥拒掉(没推)' : '→ 进到推送流程'}`)
  console.log('   ' + r.text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).slice(0, 400))
}
console.log(`\n结论:真正进入推送的请求 = ${pushed}(必须 = 1),被互斥拒掉的 = ${rejected}(必须 = 1)`)
if (pushed !== 1 || rejected !== 1) {
  console.log('[FAIL] 两个请求都进到推送流程 ⇒ 重复入库风险仍在')
  process.exit(1)
}
console.log('[PASS] 双击只会推一次')
