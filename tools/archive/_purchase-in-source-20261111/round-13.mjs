import fs from 'node:fs/promises'

const OUT = 'C:/Users/Lenovo/ego/purchase-in-source-20261111'
await fs.mkdir(OUT, { recursive: true })

const task = await taskSpace('purchase-in-source-20261111')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=PI-2026-11-0001', { timeout: 40000 })
await page.waitForTimeout(3500)

await page.click('.locale-switch', { label: '切换语言下拉' })
await page.waitForTimeout(1000)
const langs = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item')]
  .filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
console.log('langs=' + JSON.stringify(langs))

const picked = langs.find((t) => /English/i.test(t))
if (picked) {
  const ok = await page.evaluate((want) => {
    const items = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((e) => e.offsetParent !== null)
    const hit = items.find((e) => (e.innerText || '').replace(/\s+/g, ' ').trim() === want)
    if (hit) { hit.click(); return true }
    return false
  }, picked)
  console.log('pick ' + picked + ' -> ' + ok)
}
await page.waitForTimeout(3500)

await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=PI-2026-11-0001', { timeout: 40000 })
await page.waitForTimeout(4000)
const en = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.udl-fields .field')].slice(-3).map((el) => ({
    label: (el.querySelector('label')?.innerText || '').replace(/\s+/g, ' ').trim(),
    value: el.querySelector('input, textarea')?.value || '',
  }))
  return { title: (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '), tail: fields,
    toolbar: [...document.querySelectorAll('.tools .tb-main')].map((e) => (e.innerText || '').trim()) }
})
console.log('en=' + JSON.stringify(en))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/r19-new-pi-en.png' })
console.log('shot=r19-new-pi-en.png')
