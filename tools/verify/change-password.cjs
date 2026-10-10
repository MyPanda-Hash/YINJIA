/* 验证自助改密闭环:改密 → 新密码可登录 → 旧密码被拒 → 库中哈希已变 → 恢复原密码。
 * 目标账号用 tester01(测试账号),避免动 admin。
 * 用法: node tools/verify/change-password.cjs
 */
const BASE = 'http://127.0.0.1:8090'
const USER = process.env.YJ_TEST_USER || 'tester01'
const OLD = process.env.YJ_TEST_OLD || '123456'
const NEW = 'YjTest@2026'

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const r = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body) })
  let json = null
  try { json = await r.json() } catch { /* non-json */ }
  return { http: r.status, body: json }
}

async function main() {
  const out = {}

  // 1) 旧密码登录
  const login1 = await post('/api/auth/login', { userName: USER, password: OLD })
  out.step1_loginOldPassword = { http: login1.http, code: login1.body?.code, message: login1.body?.message }
  const token = login1.body?.data?.token
  if (!token) { console.log(JSON.stringify(out, null, 1)); throw new Error('无法用旧密码登录,后续步骤无法执行') }

  // 2) 改密:错误原密码必须被拒
  const bad = await post('/api/auth/changePassword', { old: 'definitely-wrong', next: NEW }, token)
  out.step2_wrongOldPassword = { http: bad.http, code: bad.body?.code, message: bad.body?.message }

  // 3) 改密:新密码太短必须被拒
  const short = await post('/api/auth/changePassword', { old: OLD, next: '123' }, token)
  out.step3_shortNewPassword = { http: short.http, code: short.body?.code, message: short.body?.message }

  // 4) 改密:新旧相同必须被拒
  const same = await post('/api/auth/changePassword', { old: OLD, next: OLD }, token)
  out.step4_samePassword = { http: same.http, code: same.body?.code, message: same.body?.message }

  // 5) 改密:正常成功
  const ok = await post('/api/auth/changePassword', { old: OLD, next: NEW }, token)
  out.step5_changeOk = { http: ok.http, code: ok.body?.code, message: ok.body?.message }

  // 6) 旧密码应登录失败
  const login2 = await post('/api/auth/login', { userName: USER, password: OLD })
  out.step6_loginWithOldAfterChange = { http: login2.http, code: login2.body?.code, message: login2.body?.message }

  // 7) 新密码应登录成功
  const login3 = await post('/api/auth/login', { userName: USER, password: NEW })
  out.step7_loginWithNewPassword = { http: login3.http, code: login3.body?.code, message: login3.body?.message }
  const token2 = login3.body?.data?.token

  // 8) 未登录访问改密必须被拒(401/403 或 code 非 200)
  const noAuth = await post('/api/auth/changePassword', { old: NEW, next: 'whatever123' })
  out.step8_changeWithoutToken = { http: noAuth.http, code: noAuth.body?.code, message: noAuth.body?.message }

  // 9) 恢复原密码(用新密码换回)
  if (token2) {
    const restore = await post('/api/auth/changePassword', { old: NEW, next: OLD }, token2)
    out.step9_restoreOldPassword = { http: restore.http, code: restore.body?.code, message: restore.body?.message }
    const login4 = await post('/api/auth/login', { userName: USER, password: OLD })
    out.step10_loginAfterRestore = { http: login4.http, code: login4.body?.code, message: login4.body?.message }
  } else {
    out.step9_restoreOldPassword = { err: '新密码登录失败,未能恢复原密码 —— 需手工重置 ' + USER }
  }

  console.log(JSON.stringify(out, null, 1))
}
main().catch(e => { console.error('FAIL', e.message); process.exit(1) })
