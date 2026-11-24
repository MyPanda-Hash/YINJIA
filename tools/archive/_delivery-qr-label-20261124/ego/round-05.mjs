/**
 * round-05 — 收尾:
 *   ① 作废 round-04 在测试库落的那张打印记录(MP-2026-11-0004),别让验证数据占着「已打印」额度;
 *   ② 关掉打印弹窗;
 *   ③ 把 ego 会话登回**正式库 YJ**(round-03 为验证切到了测试库,必须还原)。
 */
const OUT = 'D:/YINJIA-main/_scratch/ego-delivery-qr-20261124'
const task = await taskSpace('delivery-qr-20261124')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

// ① 作废验证用的打印记录(测试库)
const voided = await page.evaluate(async () => {
  const tok = localStorage.getItem('mes_token')
  const out = []
  for (const url of ['/api/px/puPrint/void', '/px/puPrint/void']) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
        body: JSON.stringify({ docNo: 'MP-2026-11-0004' }),
      })
      out.push({ url, status: r.status, body: (await r.text()).slice(0, 160) })
      if (r.ok) break
    } catch (e) { out.push({ url, error: e.message }) }
  }
  return out
})
console.log('① 作废打印记录 = ' + JSON.stringify(voided, null, 2))

// ② 关弹窗 + 摘打印层
await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  document.getElementById('yj-print-host')?.remove()
  document.getElementById('yj-print-host-css')?.remove()
  const dlg = document.querySelector('.el-dialog')
  const close = dlg ? dlg.querySelector('.el-dialog__headerbtn') : null
  close?.click()
  await sleep(500)
})

// ③ 会话登回正式库 YJ
await page.evaluate(() => {
  localStorage.removeItem('mes_token'); localStorage.removeItem('mes_user'); localStorage.removeItem('mes_factory')
})
await page.goto('http://localhost:5173/#/login', { timeout: 60000 })
await page.reload()
await page.waitForTimeout(3500)
const relogin = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const selects = [...document.querySelectorAll('.el-select')]
  const factorySel = selects.find((s) => (s.textContent || '').includes('工厂')) || selects[selects.length - 1]
  factorySel?.click()
  await sleep(800)
  const opts = [...document.querySelectorAll('.el-select-dropdown__item')]
  const target = opts.find((o) => (o.textContent || '').trim() === 'YINJIA-MES')
  target?.click()
  await sleep(500)
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  await sleep(300)
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  btn?.click()
  return { picked: target ? target.textContent.trim() : null, clicked: !!btn }
})
console.log('③ 重新登录(正式库)= ' + JSON.stringify(relogin))
await page.waitForTimeout(6000)
const state = await page.evaluate(() => ({
  hash: location.hash,
  factory: localStorage.getItem('mes_factory'),
  user: (() => { try { return JSON.parse(localStorage.getItem('mes_user') || '{}').name || JSON.parse(localStorage.getItem('mes_user') || '{}').account || '' } catch { return '' } })(),
  loginDate: localStorage.getItem('mes_login_date'),
}))
console.log('④ 收尾状态 = ' + JSON.stringify(state))
await page.screenshot({ path: OUT + '/round-05-restored.png' })
await task.finish({ keep: [] })
