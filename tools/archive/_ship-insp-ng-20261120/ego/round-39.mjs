const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.evaluate(() => { localStorage.setItem('mes_locale', 'en') })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(7000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return {
    locale: localStorage.getItem('mes_locale'),
    title: document.title,
    band: txt(document.querySelector('.qr-band')),
    foot: txt(document.querySelector('.qr-foot-table')),
    body: txt(document.body).slice(0, 260),
    hasEnName: /Outgoing Inspection/.test(txt(document.body)),
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s39-en.png' })
