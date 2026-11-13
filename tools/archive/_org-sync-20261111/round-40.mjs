const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
async function jwtSub() {
  return page.evaluate(() => {
    const t = localStorage.getItem('mes_token') || ''
    try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub } catch (e) { return null }
  })
}
async function logout() {
  await page.evaluate(() => { try { localStorage.removeItem('mes_token') } catch (e) {} })
  await page.goto('http://localhost:5173/', { timeout: 60000 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => location.reload())
  await page.waitForTimeout(4500)
}
async function login(user) {
  await page.evaluate((u) => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
    const pw = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (acc) setVal(acc, u)
    if (pw) setVal(pw, '123456')
  }, user)
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6500)
}
if (await jwtSub() !== 'zfy') { await logout(); await login('zfy') }
console.log('sub=' + (await jwtSub()))
await page.waitForTimeout(2000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}

// 打开消息弹层
await page.evaluate(() => { const el = document.querySelector('.nc-ref.type-msg'); if (el) el.click() })
await page.waitForTimeout(2500)
const list = await page.evaluate(() => [...document.querySelectorAll('.nc-item')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140)))
console.log(JSON.stringify(list.slice(0, 6), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-40-zfy-msglist.png' })

async function openMsg(kw) {
  await page.evaluate(() => { const el = document.querySelector('.nc-ref.type-msg'); if (el) el.click() })
  await page.waitForTimeout(1500)
  const clicked = await page.evaluate((k) => {
    const hit = [...document.querySelectorAll('.nc-item')].find((el) => (el.textContent || '').includes(k))
    if (!hit) return 'NOT-FOUND'
    hit.click(); return 'OK'
  }, kw)
  await page.waitForTimeout(2000)
  const dlg = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    return d ? (d.querySelector('.el-dialog__body')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 180) : null
  })
  return { clicked, dlg }
}
const m1 = await openMsg('JYSJ-2026-11-0003')
console.log('approveMsg=' + JSON.stringify(m1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-40-zfy-approve-detail.png' })
console.log('go=' + await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const b = d && [...d.querySelectorAll('button')].find((x) => /去处理/.test(x.textContent || ''))
  if (!b) return 'NO-BTN'
  b.click(); return 'OK'
}))
await page.waitForTimeout(7000)
console.log('jump=' + JSON.stringify(await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return { hash: location.hash, side: (txt(document.querySelector('.approval-side')) || '').slice(0, 30), material: (txt(document.querySelectorAll('.qr-head-table .qr-value')[0]) || '') }
})))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-40-zfy-jump-approve.png' })
