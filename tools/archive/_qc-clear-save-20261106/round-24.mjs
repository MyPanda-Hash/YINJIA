const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

// ── ① 还原测试库 YJ-YCYX-006 的「折数」= 75±5 ──
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REQ', { timeout: 45000 })
await page.waitForTimeout(9000)
const idx = await page.evaluate(() => [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')]
  .findIndex((tr) => (tr.innerText || '').includes('YJ-YCYX-006')))
await page.evaluate((idx) => {
  const tr = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')][idx]
  const b = tr && tr.querySelector('.rs-op-edit'); if (b) b.click()
}, idx)
await page.waitForTimeout(800)
await page.evaluate((idx) => {
  const tr = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')][idx]
  const inp = tr && tr.querySelectorAll('td .rs-c-in input')[6]
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '75±5')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
}, idx)
await page.waitForTimeout(600)
await page.evaluate((idx) => {
  const tr = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')][idx]
  const b = tr && tr.querySelector('.rs-op-done'); if (b) b.click()
}, idx)
await page.waitForTimeout(600)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.qc-bar-btn')].find((b) => (b.innerText || '').trim() === '保存')
  if (btn) btn.click()
})
await page.waitForTimeout(5000)
console.log('① 还原折数: ' + JSON.stringify(await page.evaluate(() => {
  const tr = [...document.querySelectorAll('.qc-insp-sheet .rs-t tbody tr')].find((x) => (x.innerText || '').includes('YJ-YCYX-006'))
  return tr ? [...tr.children].map((td) => (td.innerText || '').trim()) : null
})))

// ── ② 单据面板:检验数据记录 JYSJ-2026-10-0107 的「备注」清空测试 ──
await page.goto('http://127.0.0.1:8090/#/dashboard', { timeout: 45000 })
await page.reload({ timeout: 45000 })
await page.waitForTimeout(4000)
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0107', { timeout: 45000 })
await page.waitForTimeout(9000)

async function setRemark(v) {
  return page.evaluate((v) => {
    const rows = [...document.querySelectorAll('table tr')]
    const tr = rows.find((r) => /备注/.test(r.innerText || ''))
    if (!tr) return 'no-remark-row'
    const ta = tr.querySelector('textarea')
    if (!ta) return 'no-textarea(readonly?)'
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
  await page.waitForTimeout(6000)
  return page.evaluate(() => [...document.querySelectorAll('.el-message')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()))
}

console.log('② 设备注: ' + await setRemark('烟测-清空验证'))
console.log('② 保存: ' + JSON.stringify(await saveDoc()))
console.log('② 清空: ' + await setRemark(''))
console.log('② 保存: ' + JSON.stringify(await saveDoc()))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-clear-save-20261106/round-24.png' })
