/**
 * round-11:查清 8090 上明细页为什么是空(是没登录,还是接口报错)。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-11-0015&line=1', { timeout: 30000 })
await page.waitForTimeout(3000)

const info = await page.evaluate(() => ({
  hash: location.hash,
  token: (localStorage.getItem('mes_token') || '').slice(0, 24),
  factory: localStorage.getItem('mes_factory'),
  hasLoginForm: !!document.querySelector('input[placeholder*="账号"]'),
  err: (document.querySelector('.mp-err') || {}).innerText || '',
  ok: (document.querySelector('.mp-ok') || {}).innerText || '',
  bodySample: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
}))
console.log(JSON.stringify(info, null, 2))

// 顺手用 8090 源的 token 直接打一次接口,看后端怎么说
const api = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/mix/task?orderNo=GD-2026-11-0015&lineNo=1', {
    headers: { Authorization: 'Bearer ' + token },
  })
  const t = await r.text()
  return { status: r.status, body: t.slice(0, 240) }
})
console.log('== 8090 接口 ==')
console.log(JSON.stringify(api, null, 2))
