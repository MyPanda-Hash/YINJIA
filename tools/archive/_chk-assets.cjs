/**
 * _chk-assets.cjs — 逐一取回 8090 供应的入口包所引用的全部分包,报告 404
 *
 * 为什么单独查:后端正常(无异常日志)但"面板不见了",最常见的原因是
 * **assets 的哈希与 index.html 不匹配**(构建产物与 jar 不同步)⇒ 分包 404 ⇒ JS 起来一半就断,
 * 页面/面板整块不渲染。这类问题后端日志里一点痕迹都没有,只能从服务端逐个取回来看。
 *
 * 用法:node tools/archive/_chk-assets.cjs
 */
'use strict'
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8090'

;(async () => {
  const root = await fetch(BASE + '/')
  console.log('GET /  →', root.status)
  const html = await root.text()

  const entry = (html.match(/\/assets\/index-[^"]+\.js/) || [])[0]
  const css = [...html.matchAll(/\/assets\/[^"]+\.css/g)].map((m) => m[0])
  console.log('入口 JS =', entry)
  console.log('入口 CSS =', css.join(', ') || '(无)')

  const js = await (await fetch(BASE + entry)).text()

  // 入口包里引用的所有分包(静态 import 与动态 import 都会以字符串出现)
  const names = new Set()
  for (const m of js.matchAll(/["'`]\.?\/?assets\/([A-Za-z0-9_.\-]+\.(?:js|css))["'`]/g)) names.add(m[1])
  for (const m of js.matchAll(/["'`]([A-Za-z0-9_\-]+-[A-Za-z0-9_\-]+\.(?:js|css))["'`]/g)) names.add(m[1])
  const list = [...names].sort()
  console.log(`入口包引用 ${list.length} 个分包,逐个取回:`)

  let bad = 0
  for (const n of list) {
    const r = await fetch(BASE + '/assets/' + n)
    if (!r.ok) { bad++; console.log(`  ✗ HTTP ${r.status}  ${n}`) }
  }
  console.log(bad ? `\n✗ ${bad} 个分包取不到(这就是面板不见的原因)` : `\n✓ 全部分包可取(${list.length} 个)`)

  // 顺带验证关键 API 是否还正常(面板数据来源)
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const lj = await login.json()
  const token = lj.token || (lj.data && lj.data.token)
  console.log('登录 =', login.status, token ? '(拿到 token)' : '(无 token!)')
  if (token) {
    const r2 = await fetch(BASE + '/api/px/getPanelConfig?panelCode=RD_SPEC_DOC', { headers: { Authorization: 'Bearer ' + token } })
    const j2 = await r2.json()
    console.log('getPanelConfig(RD_SPEC_DOC) =', r2.status, 'code=', j2.code, 'msg=', j2.message)
  }
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('异常:', e.message); process.exit(1) })
