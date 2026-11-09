// round-01: 登录态/账套核查 + 登录页结构(不点任何业务按钮)
// 目标:确保后续 UI 流程跑在 5173 + 登录工厂 YJ_TEST(HSDZ_MES_TEST),绝不碰正式库。
const OUT = 'C:/Users/vigna/ego/wo-insp-audit-20261108'
const task = await taskSpace('wo-insp-audit-20261108')
const page = task.page('p1')
console.log('spaceId=' + task.spaceId + ' page=' + page.label)

async function info(tag) {
  const d = await page.evaluate(() => {
    const tok = localStorage.getItem('mes_token') || ''
    let claims = null
    try {
      const p = tok.split('.')[1]
      claims = JSON.parse(decodeURIComponent(escape(atob(p.replace(/-/g, '+').replace(/_/g, '/')))))
    } catch (e) { claims = { decodeError: String(e) } }
    return {
      hash: location.hash,
      href: location.href,
      tokenPresent: !!tok,
      claims,
      mesFactory: localStorage.getItem('mes_factory'),
      mesUser: (() => { try { return JSON.parse(localStorage.getItem('mes_user') || 'null') } catch { return null } })(),
      bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
      inputs: [...document.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, type: i.type, val: i.value })).slice(0, 12),
      buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 20),
      selects: [...document.querySelectorAll('.el-select, [class*="factory"], [class*="select"]')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 10),
    }
  })
  console.log('=== ' + tag + ' ===')
  console.log(JSON.stringify(d, null, 2))
  return d
}

await page.goto('http://localhost:5173/', { timeout: 30000 })
await page.waitForTimeout(3500)
const d1 = await info('after goto')

// 账套不符(或未登录)⇒ 清会话重新登录,保证用 YJ_TEST 测试库
const factory = d1.claims && d1.claims.factory
if (!d1.tokenPresent || factory !== 'YJ_TEST') {
  console.log('[action] 当前登录态 base=' + JSON.stringify({ token: d1.tokenPresent, factory }) + ' ⇒ 清会话回登录页')
  await page.evaluate(() => {
    for (const k of ['mes_token', 'mes_user', 'mes_factory', 'mes_login_date']) localStorage.removeItem(k)
  })
  await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
  await page.waitForTimeout(2500)
  await info('login page')
} else {
  console.log('[ok] 已是 YJ_TEST 测试账套登录态,无需重登')
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-01.png' })
console.log('ROUND01_DONE')
