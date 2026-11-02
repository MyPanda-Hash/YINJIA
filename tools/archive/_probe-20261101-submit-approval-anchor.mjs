/**
 * _probe-20261101-submit-approval-anchor.mjs —— 「报工缺少唯一工单行锚点」校验前移取证(2026-11-01)
 *
 * 用户口径:「这个需要在提交审批处来进行校验而不是点击审批通过的时候出现校验」。
 * 在**测试账套**(YJ_TEST → HSDZ_MES_TEST)上验证 callButton「提交审批」:
 *   · 缺行锚点(工单行号=0 且批次号不能唯一定位)⇒ 当场被拒,文案「…不能提交审批」;
 *   · 行锚点齐全 ⇒ 正常进入「审批中」(正常单据不受影响)。
 *
 * 用法(node tools 目录下):
 *   node archive\_probe-20261101-submit-approval-anchor.mjs fail    # 期望被拒
 *   node archive\_probe-20261101-submit-approval-anchor.mjs ok      # 期望提交成功
 * 前置:`_seed-20261101-anchor-test.sql` 灌入 BG-TEST-ANCHOR 草稿。
 */
const BASE = 'http://127.0.0.1:8090'
const DOC_NO = process.env.TEST_DOC_NO || 'BG-TEST-ANCHOR'
const EXPECT = process.argv[2] || 'fail' // fail | ok

async function login(factory) {
  const r = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
  })).json()
  if (!r.data || !r.data.token) throw new Error('登录失败(' + factory + '): ' + JSON.stringify(r).slice(0, 300))
  return r.data.token
}

async function callButton(token, buttonName) {
  const res = await fetch(BASE + '/api/px/callButton', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode: 'WO_REPORT', buttonName, formData: { 编号: DOC_NO } }),
  })
  return await res.json()
}

const token = await login('YJ_TEST')
console.log('[login] 测试账套(token factory=YJ_TEST) OK | 单号 =', DOC_NO, '| 期望 =', EXPECT)

const r = await callButton(token, '提交审批')
const msg = String(r.message || '')
console.log('[提交审批] code =', r.code, '| message =', msg, '| data =', JSON.stringify(r.data || null).slice(0, 160))

const pass = EXPECT === 'fail'
  ? (r.code !== 200 && msg.includes('唯一工单行锚点') && msg.includes('不能提交审批'))
  : (r.code === 200 && JSON.stringify(r.data || '').includes('审批中'))
console.log('判定 =', pass ? 'PASS' : 'FAIL')
if (!pass) process.exit(1)
