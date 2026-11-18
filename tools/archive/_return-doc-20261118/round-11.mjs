/**
 * round-11:从「生产领料」的已完成单据页点「去生产退料」——
 * 应**一跳直达**退料明细页(?no= → 反查 id),不再先落在列表页。
 */
const task = await taskSpace('return-doc-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK/doc?id=823', { timeout: 30000 })
await page.waitForTimeout(3000)
await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()) })

const pickup = await page.evaluate(() => ({
  title: (document.querySelector('.mp-title') || {}).innerText || '',
  state: (document.querySelector('.mp-state') || {}).innerText || '',
  foot: [...document.querySelectorAll('.mp-foot button')].map((b) => (b.textContent || '').trim()),
}))
console.log('== 生产领料单(已完成)底栏 ==')
console.log(JSON.stringify(pickup, null, 2))

const btn = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.mp-foot button')].find((x) => (x.textContent || '').includes('去生产退料'))
  if (b) { b.click(); return true }
  return false
})
await page.waitForTimeout(3500)
const after = await page.evaluate(() => ({
  clicked: true,
  hash: location.hash,
  title: (document.querySelector('.mp-title') || {}).innerText || '',
  state: (document.querySelector('.mp-state') || {}).innerText || '',
  kvFirst: [...document.querySelectorAll('.mp-kv')].slice(0, 3).map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  scanArea: !!document.querySelector('input[placeholder*="扫物料码"]'),
  err: (document.querySelector('.mp-err') || {}).innerText || '',
}))
console.log('== 点「去生产退料」之后 ==')
console.log(JSON.stringify({ btn, ...after }, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-11-jump.png' })
