/**
 * round-02:展开「已完成」组 + 用「打开单据」按工单号定位 → 打开该工单行的**混料单明细**。
 *
 * 口径(用户原话):「应该和生产领料一样也是跳转到单据的明细里面再开始扫物料码」。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 30000 })
await page.waitForTimeout(3000)

// 展开「已完成」
await page.click('text=已完成')
await page.waitForTimeout(800)
const doneInfo = await page.evaluate(() => ({
  doneCards: [...document.querySelectorAll('.mm-card')][2]
    ? [...document.querySelectorAll('.mm-card')][2].innerText.replace(/\s+/g, ' ').trim().slice(0, 400)
    : '',
}))
console.log('== 已完成组 ==')
console.log(JSON.stringify(doneInfo, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-02-list-done.png' })

// 按工单号定位 → 打开明细
await page.fill('input[placeholder*="扫工单码"]', 'GD-2026-11-0015')
await page.waitForTimeout(300)
await page.click('text=打开单据')
await page.waitForTimeout(3000)

const docInfo = await page.evaluate(() => {
  const kv = [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim())
  const rows = [...document.querySelectorAll('.mp-line')].map((el) => el.innerText.replace(/\s+/g, ' ').trim())
  const btn = [...document.querySelectorAll('.mp-foot button')].map((b) => ({
    text: (b.textContent || '').trim(),
    disabled: !!b.disabled,
  }))
  return {
    hash: location.hash,
    title: (document.querySelector('.mp-title') || {}).innerText,
    state: (document.querySelector('.mp-state') || {}).innerText,
    kv,
    rows,
    footButtons: btn,
    footNote: (document.querySelector('.mp-foot-note') || {}).innerText || '',
    scale: (document.querySelector('.mp-scale') || {}).innerText || '',
    err: (document.querySelector('.mp-err') || {}).innerText || '',
    placeholder: (document.querySelector('.mp-row input') || {}).placeholder || '',
  }
})
console.log('== 明细页(未完成) ==')
console.log(JSON.stringify(docInfo, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-02-doc.png' })
