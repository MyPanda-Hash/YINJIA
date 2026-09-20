/**
 * _chk-wx-login-contract.cjs — 小程序走「只调接口」路线所需的接口契约(真实响应取证)
 *
 * 抓的是小程序必须照抄的四件事:
 *   ① 登录成功响应体形状(字段名/大小写)与 JWT 里的过期时间(决定何时重新登录)
 *   ② 未带 token 访问受保护接口返回什么(403 而不是 401 —— 小程序要按这个判"未登录")
 *   ③ 带 token 访问同一接口 → 200
 *   ④ 参数缺失(400) / 口令错误(409) 的状态码与文案
 * 用法:node tools/archive/_chk-wx-login-contract.cjs
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'

const mask = (t) => (t ? t.slice(0, 24) + `…(共 ${t.length} 字符)` : '(无)')
const decodeJwt = (t) => {
  try {
    const [h, p] = t.split('.')
    const head = JSON.parse(Buffer.from(h.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    const body = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return { head, body }
  } catch (e) { return null }
}
const post = async (path, body, token) => {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = 'Bearer ' + token
  const r = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body) })
  const text = await r.text()
  let j = null
  try { j = JSON.parse(text) } catch (e) { /* 非 JSON */ }
  return { http: r.status, json: j, text: text.slice(0, 200) }
}
/** ⚠ /api/auth/perms 是 @GetMapping:用 POST 打它会 500 "Request method 'POST' is not supported"
 *  (第一版探针就踩了,断言因此假失败)。 */
const get = async (path, token) => {
  const headers = {}
  if (token) headers.Authorization = 'Bearer ' + token
  const r = await fetch(BASE + path, { method: 'GET', headers })
  const text = await r.text()
  let j = null
  try { j = JSON.parse(text) } catch (e) { /* 非 JSON */ }
  return { http: r.status, json: j, text: text.slice(0, 200) }
}

;(async () => {
  let bad = 0
  const chk = (n, v, d) => { if (!v) bad++; console.log(`  ${v ? '✓' : '✗'} ${n}${!v && d ? '  → ' + d : ''}`) }

  console.log('① 登录成功:POST /api/auth/login {userName, password}')
  const ok = await post('/api/auth/login', { userName: 'admin', password: '123456' })
  const data = ok.json && ok.json.data
  console.log(`   HTTP ${ok.http}  →  ${JSON.stringify({ code: ok.json && ok.json.code, message: ok.json && ok.json.message })}`)
  console.log(`   data.token = ${mask(data && data.token)}`)
  console.log(`   data.user  = ${JSON.stringify(data && data.user)}`)
  chk('HTTP 200 且 code=200', ok.http === 200 && ok.json.code === 200)
  chk('data.token / data.user 存在', !!(data && data.token && data.user))
  chk('user 字段名是小写驼峰(userName/realName/isAdmin)', !!(data && data.user && 'userName' in data.user && 'isAdmin' in data.user))

  const jwt = decodeJwt(data && data.token)
  if (jwt) {
    const iat = new Date(jwt.body.iat * 1000), exp = new Date(jwt.body.exp * 1000)
    console.log(`   JWT 头 = ${JSON.stringify(jwt.head)}`)
    console.log(`   JWT 载荷 = ${JSON.stringify(jwt.body)}`)
    console.log(`   签发 ${iat.toISOString()} → 过期 ${exp.toISOString()}(有效期 ${(jwt.body.exp - jwt.body.iat) / 3600} 小时)`)
    chk('JWT 带 sub/iat/exp', !!(jwt.body.sub && jwt.body.iat && jwt.body.exp))
    chk('有效期 = 24 小时(与 yinjia.jwt.expire-hours 一致)', (jwt.body.exp - jwt.body.iat) === 24 * 3600)
  }

  console.log('')
  console.log('② 不带 token 访问受保护接口:GET /api/auth/perms')
  const noTk = await get('/api/auth/perms', null)
  console.log(`   HTTP ${noTk.http}  body=${JSON.stringify(noTk.text)}`)
  chk('未带 token → 403(小程序按 403 判"未登录/需重新登录")', noTk.http === 403, 'HTTP ' + noTk.http)

  console.log('')
  console.log('③ 带 token 访问同一接口')
  const withTk = await get('/api/auth/perms', data && data.token)
  console.log(`   HTTP ${withTk.http}  body=${JSON.stringify(withTk.json)}`)
  chk('带 token → 200', withTk.http === 200, 'HTTP ' + withTk.http)

  console.log('')
  console.log('④ 失败分支:参数缺失 / 口令错误')
  const empty = await post('/api/auth/login', { userName: '', password: '' })
  console.log(`   空参数 → HTTP ${empty.http} message=${JSON.stringify(empty.json && empty.json.message)}`)
  chk('空参数 → 400 且信息含"不能为空"', empty.http === 400 && /不能为空/.test(String(empty.json && empty.json.message)))
  const wrong = await post('/api/auth/login', { userName: 'admin', password: 'wrong-pw' })
  console.log(`   错口令 → HTTP ${wrong.http} message=${JSON.stringify(wrong.json && wrong.json.message)}`)
  chk('错口令 → 409 且文案统一为"用户名或密码错误"', wrong.http === 409 && wrong.json.message === '用户名或密码错误')

  console.log('')
  console.log(bad ? `✗ ${bad} 项不符` : '✓ 接口契约固定:登录免鉴权、其余接口 Bearer、403=未认证、400/409 分支清晰')
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('异常:', e.stack || e.message); process.exit(1) })
