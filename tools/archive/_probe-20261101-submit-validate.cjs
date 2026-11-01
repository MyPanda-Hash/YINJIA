/**
 * _probe-20261101-submit-validate.cjs —— 「提交审批」时跑完整报工校验的取证(2026-11-01)
 *
 * 背景:用户口径「这个需要在提交审批处来进行校验而不是点击审批通过的时候出现校验」+「当前这个也是」
 *   ⇒ 报工整行校验(行锚点/工序在路线内/不跳序/数量上限/工单结案·排产)全部前移到提交审批。
 * 本探针在**测试账套**(token factory=YJ_TEST → HSDZ_MES_TEST)点「提交审批」,打印返回码与文案。
 *
 * 用法(tools 目录):
 *   node archive\_probe-20261101-submit-validate.cjs <单号> [期望文案关键字...]
 *   给关键字则全部命中算 PASS;不给则只打印(供人工判读)。
 * 夹具:`_seed-20261101-opname-test.sql`(坏工序编码 OP-CX)、修数后同一张单应可送审。
 */
const BASE = 'http://127.0.0.1:8090'
const DOC_NO = process.argv[2] || 'BG-TEST-OPNAME'
const WANTS = process.argv.slice(3)

async function main() {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  if (!login.data?.token) throw new Error('测试账套登录失败: ' + JSON.stringify(login).slice(0, 200))

  const res = await fetch(BASE + '/api/px/callButton', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token },
    body: JSON.stringify({ panelCode: 'WO_REPORT', buttonName: '提交审批', formData: { 编号: DOC_NO } }),
  })
  const r = await res.json()
  const msg = String(r.message || '')
  console.log('[提交审批] 单号 =', DOC_NO)
  console.log('  code =', r.code, '| message =', msg, '| data =', JSON.stringify(r.data || null).slice(0, 140))

  if (!WANTS.length) return
  const pass = WANTS.every((w) => msg.includes(w))
  console.log('  判定 =', pass ? 'PASS(文案命中: ' + WANTS.join(' / ') + ')' : 'FAIL(期望含 ' + WANTS.join(' / ') + ')')
  if (!pass) process.exit(1)
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
