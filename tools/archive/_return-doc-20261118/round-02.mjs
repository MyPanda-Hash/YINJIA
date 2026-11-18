/**
 * round-02:点「LL-2026-11-0006」进**单据明细页**,看抬头 + 明细行(已领/已退/本次退)。
 */
const task = await taskSpace('return-doc-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN', { timeout: 30000 })
await page.waitForTimeout(3000)
await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()) })

await page.click('.mr-doc:has-text("LL-2026-11-0006")')
await page.waitForTimeout(3000)

const info = await page.evaluate(() => ({
  hash: location.hash,
  title: (document.querySelector('.mp-title') || {}).innerText || '',
  sub: (document.querySelector('.mp-sub2') || {}).innerText || '',
  state: (document.querySelector('.mp-state') || {}).innerText || '',
  readOnlyBanner: (document.querySelector('.mp-ro') || {}).innerText || '',
  kv: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  rows: [...document.querySelectorAll('.mp-line')].map((el) => {
    const q = [...el.querySelectorAll('.mp-q-row')].map((x) => x.innerText.replace(/\s+/g, ' ').trim())
    return { name: (el.querySelector('.mp-line-name') || {}).innerText || '', qty: q }
  }),
  scanArea: !!document.querySelector('input[placeholder*="扫物料码"]'),
  footButtons: [...document.querySelectorAll('.mp-foot button')].map((b) => ({ text: (b.textContent || '').trim(), disabled: !!b.disabled })),
  err: (document.querySelector('.mp-err') || {}).innerText || '',
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-02-doc.png' })
