/**
 * round-10:8090(打包产物 = 部署来源)上复核两页:列表页 + 明细页(入口 chunk 应已换新)。
 */
const task = await taskSpace('return-doc-20261118')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/MOBILE_RETURN', { timeout: 30000 })
await page.waitForTimeout(4000)
const list = await page.evaluate(() => ({
  hash: location.hash,
  chunk: [...document.querySelectorAll('script[src]')].map((s) => s.src).filter((s) => /index-/.test(s)).slice(-1)[0] || '',
  sub: (document.querySelector('.mr-sub') || {}).innerText || '',
  groups: [...document.querySelectorAll('.mr-grp-head')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  firstDoc: (document.querySelector('.mr-doc') || {}).innerText || '',
  err: (document.querySelector('.mr-err') || {}).innerText || '',
}))
console.log('== 8090 列表页 ==')
console.log(JSON.stringify(list, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-10-8090-list.png' })

await page.goto('http://127.0.0.1:8090/#/panelx/list/MOBILE_RETURN/doc?id=823', { timeout: 30000 })
await page.waitForTimeout(3000)
const doc = await page.evaluate(() => ({
  hash: location.hash,
  title: (document.querySelector('.mp-title') || {}).innerText || '',
  state: (document.querySelector('.mp-state') || {}).innerText || '',
  kv: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  rows: [...document.querySelectorAll('.mp-line')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  scanArea: !!document.querySelector('input[placeholder*="扫物料码"]'),
  err: (document.querySelector('.mp-err') || {}).innerText || '',
}))
console.log('== 8090 明细页 ==')
console.log(JSON.stringify(doc, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-10-8090-doc.png' })
