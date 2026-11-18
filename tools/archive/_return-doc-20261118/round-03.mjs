/**
 * round-03:扫**不在本单里的料**(必须拒绝)+ 扫本单料解锁 → 填 4 → 确认;看进度与提交闸门。
 */
const task = await taskSpace('return-doc-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN/doc?id=823', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()) })

const state = () => page.evaluate(() => ({
  err: (document.querySelector('.mp-err') || {}).innerText || '',
  ok: (document.querySelector('.mp-ok') || {}).innerText || '',
  unlocked: (document.querySelector('.mp-mat') || {}).innerText || '',
  curQty: (document.querySelector('.mp-qty input') || {}).value || '',
  progress: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()).find((t) => t.startsWith('本次退料')) || '',
  rows: [...document.querySelectorAll('.mp-line')].map((el) => ({
    name: (el.querySelector('.mp-line-name') || {}).innerText || '',
    qty: [...el.querySelectorAll('.mp-q-row')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()),
    highlighted: el.classList.contains('is-ret'),
  })),
  foot: [...document.querySelectorAll('.mp-foot button')].map((b) => ({ text: (b.textContent || '').trim(), disabled: !!b.disabled })),
}))

// ① 扫错料
await page.fill('input[placeholder*="扫物料码"]', 'WRONG-001')
await page.keyboard.press('Enter')
await page.waitForTimeout(1800)
console.log('== ① 扫不在本单的料 ==')
console.log(JSON.stringify(await state(), null, 2))

// ② 扫本单第一个料(热缩袋 YJ-KBL-003),解锁
await page.fill('input[placeholder*="扫物料码"]', 'YJ-KBL-003|20261118001')
await page.keyboard.press('Enter')
await page.waitForTimeout(1800)
console.log('== ② 扫本单物料(解锁) ==')
console.log(JSON.stringify(await state(), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-03-unlock.png' })

// ③ 改成 4 并确认
await page.fill('.mp-qty input', '4')
await page.waitForTimeout(300)
await page.click('.mp-qty button:first-of-type')
await page.waitForTimeout(1500)
console.log('== ③ 确认 4 之后 ==')
console.log(JSON.stringify(await state(), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-03-confirmed.png' })
