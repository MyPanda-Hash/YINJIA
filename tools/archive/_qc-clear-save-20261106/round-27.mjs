const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0107', { timeout: 45000 })
await page.waitForTimeout(9000)

const btns = await page.evaluate(() => [...document.querySelectorAll('button')]
  .map((b) => ({ t: (b.innerText || '').replace(/\s+/g, ''), d: !!b.disabled || b.classList.contains('is-disabled'), cls: String(b.className).slice(0, 50) }))
  .filter((x) => x.t.includes('保存') || x.t.includes('提交')))
console.log('按钮: ' + JSON.stringify(btns, null, 2))

async function setOpinion(v) {
  return page.evaluate((v) => {
    const ta = document.querySelector('textarea.el-textarea__inner')
    if (!ta) return 'no-textarea'
    const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    s.call(ta, v)
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    ta.dispatchEvent(new Event('change', { bubbles: true }))
    ta.blur()
    return 'set=' + JSON.stringify(v)
  }, v)
}
async function clickSave() {
  return page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\s+/g, '') === '保存')
    if (!b) return 'no-btn'
    if (b.disabled || b.classList.contains('is-disabled')) return 'disabled'
    b.click()
    return 'clicked'
  })
}
async function toasts(sec = 6) {
  const seen = []
  for (let i = 0; i < sec; i++) {
    const now = await page.evaluate(() => [...document.querySelectorAll('.el-message, .el-notification')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()))
    for (const t of now) if (!seen.includes(t)) seen.push(t)
    await page.waitForTimeout(1000)
  }
  return seen
}

console.log('① 填: ' + await setOpinion('烟测-清空验证'))
await page.waitForTimeout(700)
console.log('① 点保存: ' + await clickSave())
console.log('① toast: ' + JSON.stringify(await toasts()))

await page.waitForTimeout(1500)
console.log('② 清空: ' + await setOpinion(''))
await page.waitForTimeout(700)
console.log('② 点保存: ' + await clickSave())
console.log('② toast: ' + JSON.stringify(await toasts()))

const state = await page.evaluate(() => ({
  ta: document.querySelector('textarea.el-textarea__inner')?.value ?? null,
  hash: location.hash,
}))
console.log('③ 画面: ' + JSON.stringify(state))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-clear-save-20261106/round-27.png' })
