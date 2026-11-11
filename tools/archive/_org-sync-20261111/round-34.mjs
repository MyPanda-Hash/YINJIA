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
console.log('start sub=' + (await jwtSub()))
if (await jwtSub() !== 'fm') { await logout(); await login('fm') }
console.log('sub=' + (await jwtSub()))

await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0002', { timeout: 60000 })
await page.waitForTimeout(8000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}

console.log('click=' + await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.approval-side .as-side-btn')].find((b) => (b.textContent || '').replace(/\s+/g, '') === '审批通过')
  if (!btn) return 'NO-BTN'
  btn.click()
  return 'APPROVE-CLICKED'
}))
await page.waitForTimeout(2000)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-message-box, .el-dialog')].find((x) => x.offsetParent !== null)
  return d ? { text: (d.textContent || '').replace(/\s+/g, ' ').slice(0, 160), inputs: d.querySelectorAll('input,textarea').length, buttons: [...d.querySelectorAll('button')].map((b) => (b.textContent || '').trim()) } : null
})
console.log('dialog=' + JSON.stringify(dlg))
if (dlg) {
  // 意见可空:直接点确认
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-message-box, .el-dialog')].find((x) => x.offsetParent !== null)
    const btn = [...d.querySelectorAll('button')].find((b) => /确定|确认/.test(b.textContent || ''))
    if (btn) btn.click()
  })
}
const msgs = []
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  if (m.length) msgs.push(...m)
}
console.log('msgs=' + JSON.stringify([...new Set(msgs)]))
await page.waitForTimeout(1500)
console.log(JSON.stringify(await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return { side: (txt(document.querySelector('.approval-side')) || '').slice(0, 40) }
})))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-34-fm-approved.png' })
