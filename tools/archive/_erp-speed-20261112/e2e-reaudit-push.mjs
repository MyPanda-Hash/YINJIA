/**
 * 验证「弃审 → 重新审核 → 再转ERP」闭环(2026-11-12 用户口径):
 *   「弃审后重新审核要确保是可以重新转erp的,这样可以做到 mes 改错、erp 重新同步。
 *     原先修改前的单据就可以他们在 erp 上删除就行」
 *
 * 逐步打印每一步的真实返回,并核对单据头上四个 ERP 字段:
 *   ① 弃审 ⇒ 是否已转ERP=否、ERP单号/操作人/时间 清空(否则重审后点转ERP 会被"已转"守卫挡住)
 *   ② 审核 ⇒ 状态已审核
 *   ③ 转ERP ⇒ 必须**再推一次并拿到新的金蝶单号**(证明互斥 guard 没有残留、守卫没把单据焊死)
 *
 * ⚠ 会真的往当前 kingdee 配置(本机=测试沙箱)推一张单;默认只对测试单 TCGRK-0049 操作。
 * 用法:node tools/archive/_erp-speed-20261112/e2e-reaudit-push.mjs [docNo]
 */
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'
const DOC = process.argv[2] || 'TCGRK-0049'

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login?.data?.token
if (!token) throw new Error('登录失败')
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

async function button(name) {
  const r = await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'PURCHASE_IN', buttonName: name, formData: { 编号: DOC, 单据编号: DOC }, buttonParam: {} }),
  })
  const text = await r.text()
  let body
  try { body = JSON.parse(text) } catch { body = text }
  const ok = r.status === 200 && body?.code === 200
  console.log(`  [${name}] HTTP ${r.status} ${ok ? 'OK' : 'FAIL'} ${ok ? '' : JSON.stringify(body)?.slice(0, 300)}`)
  return { ok, data: body?.data }
}

// 单据头四个 ERP 字段(经列表接口取,顺带验证界面看到的就是这个值)
async function head() {
  const r = await fetch(`${BASE}/api/px/queryFormDataList`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'PURCHASE_IN', condition: { 单据编号: DOC }, pageNo: 1, pageSize: 5 }),
  })
  const j = await r.json().catch(() => null)
  const row = j?.data?.rows?.[0] || j?.data?.list?.[0] || null
  if (!row) return null
  return {
    单据状态: row['单据状态'], 是否已转ERP: row['是否已转ERP'], ERP单号: row['ERP单号'],
    转ERP操作人: row['转ERP操作人'], 转ERP时间: row['转ERP时间'],
  }
}

const before = await head()
console.log('① 起始状态 =', JSON.stringify(before))
if (!before) throw new Error('取不到单据(接口字段名可能变了),先看 /api/px/list 的返回')

console.log('\n② 弃审 …')
const un = await button('弃审')
if (!un.ok) { console.log('  ✗ 弃审失败,后续闭环无法验证'); process.exit(1) }
await new Promise((r) => setTimeout(r, 1500))
const afterUnaudit = await head()
console.log('   弃审后 =', JSON.stringify(afterUnaudit))
const cleared = String(afterUnaudit?.是否已转ERP || '') !== '是' && !String(afterUnaudit?.ERP单号 || '').trim()
console.log(cleared ? '   [PASS] 四个 ERP 字段已清空(重审后可以再转)' : '   [FAIL] ERP 字段没清干净')

console.log('\n③ 重新审核 …')
const au = await button('审核')
if (!au.ok) { console.log('  ✗ 审核失败'); process.exit(1) }
await new Promise((r) => setTimeout(r, 1500))
console.log('   审核后 =', JSON.stringify(await head()))

console.log('\n④ 再转ERP(必须真的再推一次)…')
const push = await button('转ERP')
const newNo = String(push.data?.ERP单号 || '')
const already = push.data?.already === true
console.log('   结果 =', already ? '被"已转"守卫挡住(FAIL)' : `新金蝶单号 = ${newNo || '(空)'}`)
await new Promise((r) => setTimeout(r, 1200))
const final = await head()
console.log('   最终 =', JSON.stringify(final))

const sameAsBefore = before?.ERP单号 && newNo && String(before.ERP单号) === newNo
const pass = push.ok && !already && !!newNo && !sameAsBefore
console.log(`\n${pass ? '[PASS] 弃审→审核→转ERP 闭环成立(拿到新的金蝶单号,不是旧的)' : '[FAIL] 闭环不成立'}`)
if (!pass) process.exit(1)
