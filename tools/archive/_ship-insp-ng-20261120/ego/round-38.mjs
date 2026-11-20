const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
// 切英文:顶栏语言下拉(简体中文) → English
await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.el-select, .lang-select, .locale-select')].find((e) => (e.innerText || '').includes('简体中文') && e.offsetParent)
  if (sel) sel.click()
})
await page.waitForTimeout(900)
await page.evaluate(() => {
  const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((e) => (e.innerText || '').includes('English'))
  if (opt) opt.click()
})
await page.waitForTimeout(3500)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return {
    title: document.title,
    tab: txt(document.querySelector('.tabs, .tab-bar')),
    band: txt(document.querySelector('.qr-band')),
    body: txt(document.body).slice(0, 300),
    menuHit: /Outgoing Inspection/.test(txt(document.body)),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s38-en.png' })
