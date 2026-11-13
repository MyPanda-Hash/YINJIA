const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
async function jwtSub() {
  return page.evaluate(() => {
    const t = localStorage.getItem('mes_token') || ''
    try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub } catch (e) { return null }
  })
}
if (await jwtSub() !== 'fm') {
  await page.evaluate(() => { try { localStorage.removeItem('mes_token') } catch (e) {} })
  await page.goto('http://localhost:5173/', { timeout: 60000 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => location.reload())
  await page.waitForTimeout(4500)
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
    const pw = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (acc) setVal(acc, 'fm')
    if (pw) setVal(pw, '123456')
  })
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
    if (b) b.click()
  })
  await page.waitForTimeout(7000)
}
console.log('sub=' + (await jwtSub()))
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0006', { timeout: 60000 })
await page.waitForTimeout(9000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
console.log('approve=' + await page.evaluate(() => {
  const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find((x) => (x.textContent || '').replace(/\s+/g, '') === '审批通过')
  if (!b) return 'NO-BTN'
  b.click(); return 'OK'
}))
await page.waitForTimeout(1600)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-message-box')].find((x) => x.offsetParent !== null)
  const b = d && [...d.querySelectorAll('button')].find((x) => /确认审批通过/.test(x.textContent || ''))
  if (b) b.click()
})
await page.waitForTimeout(5000)
console.log('side=' + await page.evaluate(() => {
  const el = document.querySelector('.approval-side')
  return el ? (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24) : ''
}))
const state = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')]
  return {
    rows: rows.length,
    textareas: rows.map((tr) => !!tr.querySelector('td.c-std textarea')),
    preSpans: rows.map((tr) => { const s = tr.querySelector('td.c-std .qr-pre'); return s ? getComputedStyle(s).whiteSpace : null }),
    rowHeights: rows.map((tr) => Math.round(tr.getBoundingClientRect().height)),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-56-readonly.png' })
