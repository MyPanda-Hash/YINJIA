const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0107', { timeout: 45000 })
await page.waitForTimeout(9000)

// 先补一行检验项(否则保存被「请至少添加一行明细」拦下)
const add = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((e) => (e.textContent || '').replace(/\s+/g, '').includes('新增检验项') && e.children.length <= 2)
  if (el) { el.click(); return 'added' }
  return 'no-add'
})
console.log('补明细行: ' + add)
await page.waitForTimeout(1500)

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
async function save() {
  const r = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div.as-side-btn, span.as-side-btn, button')].find((e) => (e.innerText || '').replace(/\s+/g, '') === '保存')
    if (!el) return 'no-btn'
    el.click()
    return 'clicked'
  })
  const seen = []
  for (let i = 0; i < 7; i++) {
    const now = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()))
    for (const t of now) if (!seen.includes(t)) seen.push(t)
    await page.waitForTimeout(1000)
  }
  return { r, seen }
}

console.log('① 填: ' + await setOpinion('烟测-清空验证'))
await page.waitForTimeout(700)
console.log('① 保存: ' + JSON.stringify(await save()))
await page.waitForTimeout(1500)
console.log('② 清空: ' + await setOpinion(''))
await page.waitForTimeout(700)
console.log('② 保存: ' + JSON.stringify(await save()))
console.log('③ 画面值: ' + JSON.stringify(await page.evaluate(() => document.querySelector('textarea.el-textarea__inner')?.value ?? null)))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-clear-save-20261106/round-30.png' })
