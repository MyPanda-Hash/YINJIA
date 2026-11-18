/**
 * round-03:在明细页**扫物料码解锁**(纸面条码 存货编码|批号),看解锁区与数量框。
 * 现场口径:「解锁对应的物料码,然后根据连接电子秤的取数,点击确认」。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-11-0015&line=1', { timeout: 30000 })
await page.waitForTimeout(2500)

// ① 先扫一个**不在物料清单里**的料 → 必须拒绝解锁(不能把错料记进单里)
await page.fill('input[placeholder*="扫物料码"]', 'YJ-NOT-EXIST-001|20261118001')
await page.keyboard.press('Enter')
await page.waitForTimeout(1800)
const wrong = await page.evaluate(() => ({
  err: (document.querySelector('.mp-err') || {}).innerText || '',
  unlocked: !!document.querySelector('.mp-mat'),
}))
console.log('== 扫不在清单里的料 ==')
console.log(JSON.stringify(wrong, null, 2))

// ② 扫本单第一个料(码里带批号)→ 解锁
await page.fill('input[placeholder*="扫物料码"]', 'YJ-TJHZ-001|20261118001')
await page.keyboard.press('Enter')
await page.waitForTimeout(1800)
const unlocked = await page.evaluate(() => {
  const qty = document.querySelector('.mp-qty input')
  return {
    err: (document.querySelector('.mp-err') || {}).innerText || '',
    ok: (document.querySelector('.mp-ok') || {}).innerText || '',
    unlocked: !!document.querySelector('.mp-mat'),
    matText: (document.querySelector('.mp-mat') || {}).innerText || '',
    stock: (document.querySelector('.mp-mat-stock') || {}).innerText || '',
    qtyLabel: (document.querySelector('.mp-qty-label') || {}).innerText || '',
    qtyValue: qty ? qty.value : '',
    confirmDisabled: (() => {
      const b = [...document.querySelectorAll('.mp-qty button')].find((x) => (x.textContent || '').includes('确认'))
      return b ? !!b.disabled : null
    })(),
    buttons: [...document.querySelectorAll('.mp-qty button')].map((b) => (b.textContent || '').trim()),
  }
})
console.log('== 扫本单物料(解锁) ==')
console.log(JSON.stringify(unlocked, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-03-unlock.png' })
