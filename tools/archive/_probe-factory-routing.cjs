/**
 * _probe-factory-routing.cjs — 两账套路由(ADR-0003)验收探针
 *
 * 背景:此前 DataSourceRouter.use() 全后端无调用者、登录页也不发所选工厂 ——
 * 选「测试库」实际仍落正式库。本探针验证接上之后确实按工厂分流。
 *
 * 覆盖:
 *   A) 工厂清单:/base/factory/list 返回 2 个(YJ 正式 / YJ_TEST 测试)
 *   B) 令牌声明:登录时所选工厂写进 JWT;不传 → 默认 YJ;传非法值 → 回落 YJ(安全默认)
 *   C) 真分流:用 YJ_TEST 会话建标记账号 → 只有 YJ_TEST 会话看得见,正式会话看不见
 *   D) 不串库:交替请求 3 轮,各自始终只看到自己库的东西(验 finally clear 生效)
 *
 * ⚠ 只在测试库(HSDZ_MES_TEST)建/删一个标记账号,不碰正式库数据。
 * 用法:node tools/archive/_probe-factory-routing.cjs
 */
const API = 'http://127.0.0.1:8090/api'
const MARK = 'zz_probe_testdb'
const PWD = 'Probe@12345'

let pass = 0, fail = 0
const ok = (name, cond, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')) }
}

async function call(method, p, { token, body } = {}) {
  const res = await fetch(API + p, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  let json = null
  try { json = await res.json() } catch { /* ignore */ }
  return { http: res.status, code: json?.code, message: json?.message, data: json?.data }
}

const claimOf = (token) => {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
  } catch { return null }
}

async function login(body) {
  const r = await call('POST', '/auth/login', { body })
  return { token: r.data?.token, user: r.data?.user, r }
}

async function userNames(token) {
  const r = await call('GET', '/sys/user/list', { token })
  return (r.data || []).map((u) => u.userName)
}

async function main() {
  console.log('== 两账套路由(ADR-0003)验收 ==\n')

  // ── A) 工厂清单 ────────────────────────────────────────────
  const fl = await call('GET', '/base/factory/list')
  const codes = (fl.data || []).map((f) => f.code)
  console.log('A) 工厂清单: ' + JSON.stringify(fl.data))
  ok('A1 返回 2 个工厂', codes.length === 2, JSON.stringify(codes))
  ok('A2 含 YJ 与 YJ_TEST', codes.includes('YJ') && codes.includes('YJ_TEST'), JSON.stringify(codes))
  ok('A3 名称非空', (fl.data || []).every((f) => f.name && f.name.length), JSON.stringify(fl.data))

  // ── B) 令牌声明 ────────────────────────────────────────────
  console.log('\nB) 令牌里的工厂声明')
  const prod = await login({ userName: 'admin', password: '123456', factory: 'YJ' })
  const test = await login({ userName: 'admin', password: '123456', factory: 'YJ_TEST' })
  const none = await login({ userName: 'admin', password: '123456' })
  const junk = await login({ userName: 'admin', password: '123456', factory: 'HACK_DB' })
  ok('B1 正式登录成功且声明=YJ', !!prod.token && claimOf(prod.token)?.factory === 'YJ', JSON.stringify(claimOf(prod.token)?.factory))
  ok('B2 测试登录成功且声明=YJ_TEST', !!test.token && claimOf(test.token)?.factory === 'YJ_TEST', JSON.stringify(claimOf(test.token)?.factory))
  ok('B3 不传工厂 → 默认 YJ(老客户端兼容)', claimOf(none.token)?.factory === 'YJ', JSON.stringify(claimOf(none.token)?.factory))
  ok('B4 非法工厂 → 回落 YJ(安全默认)', claimOf(junk.token)?.factory === 'YJ', JSON.stringify(claimOf(junk.token)?.factory))
  ok('B5 登录响应带回 factory', prod.user?.factory === 'YJ' && test.user?.factory === 'YJ_TEST',
    prod.user?.factory + '/' + test.user?.factory)

  let markId = null
  try {
    // ── C) 真分流:标记账号只应存在于测试库 ────────────────────
    console.log('\nC) 读写分流(标记账号只建在测试库)')
    const stale = (await call('GET', '/sys/user/list', { token: test.token })).data?.find((u) => u.userName === MARK)
    if (stale) await call('DELETE', '/sys/user/' + stale.id, { token: test.token })
    const mk = await call('POST', '/sys/user/save', {
      token: test.token, body: { userName: MARK, password: PWD, realName: '路由探针-仅测试库', enabled: 1 },
    })
    ok('C1 测试会话可建账号', mk.code === 200, JSON.stringify(mk).slice(0, 140))
    markId = (await call('GET', '/sys/user/list', { token: test.token })).data?.find((u) => u.userName === MARK)?.id

    const inTest = await userNames(test.token)
    const inProd = await userNames(prod.token)
    ok('C2 测试会话看得见它', inTest.includes(MARK), '测试库账号数=' + inTest.length)
    ok('C3 正式会话看不见它(证明确实分库)', !inProd.includes(MARK), '正式库账号数=' + inProd.length)

    // ── D) 不串库:交替请求 ───────────────────────────────────
    console.log('\nD) 交替请求不串库(验 finally clear)')
    let cross = 0
    for (let i = 0; i < 3; i++) {
      const a = await userNames(prod.token)
      const b = await userNames(test.token)
      if (a.includes(MARK) || !b.includes(MARK)) cross++
    }
    ok('D1 3 轮交替请求,各自始终只看到本库数据', cross === 0, '串库轮数=' + cross)
  } finally {
    // 清理:用测试会话删掉标记账号
    if (markId) {
      const c = await call('DELETE', '/sys/user/' + markId, { token: test.token })
      console.log('\n[cleanup] 删除标记账号 → code=' + c.code)
    }
    const left = (await call('GET', '/sys/user/list', { token: test.token })).data?.some((u) => u.userName === MARK)
    console.log('[cleanup] 测试库残留检查: ' + (left ? '⚠ 仍在' : '无残留 ✓'))
    const leftProd = (await call('GET', '/sys/user/list', { token: prod.token })).data?.some((u) => u.userName === MARK)
    console.log('[cleanup] 正式库残留检查: ' + (leftProd ? '⚠ 仍在(说明串库!)' : '无残留 ✓'))
  }

  console.log('\n== 结果:' + pass + ' 通过 / ' + fail + ' 失败 ==')
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(2) })
