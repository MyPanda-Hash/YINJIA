const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0107', { timeout: 45000 })
await page.waitForTimeout(9000)

async function setOpinion(v) {
  return page.evaluate((v) => {
    const ta = document.querySelector('textarea.el-textarea__inner')
    if (!ta) return 'no-textarea'
    const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    s.call(ta, v)
    ta.dispatchEvent(new Event('input', { bubbles: true }))
    ta.dispatchEvent(new Event('change', { bubbles: true }))
    return 'set=' + JSON.stringify(v)
  }, v)
}
async function saveDoc() {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.innerText || '').replace(/\s+/g, '') === '保存')
    if (btn) btn.click()
  })
  await page.waitForTimeout(6500)
  return page.evaluate(() => [...document.querySelectorAll('.el-message')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()))
}

console.log('① 填「处理意见」: ' + await setOpinion('烟测-清空验证'))
console.log('① 保存: ' + JSON.stringify(await saveDoc()))
console.log('② 清空「处理意见」: ' + await setOpinion(''))
console.log('② 保存: ' + JSON.stringify(await saveDoc()))

// 刷新页面看回显
await page.reload({ timeout: 45000 })
await page.waitForTimeout(9000)
console.log('③ 刷新后 textarea 值: ' + JSON.stringify(await page.evaluate(() => (document.querySelector('textarea.el-textarea__inner')?.value) ?? null)))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-clear-save-20261106/round-26.png' })
