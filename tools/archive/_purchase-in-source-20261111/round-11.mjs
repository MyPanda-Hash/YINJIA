import fs from 'node:fs/promises'

const OUT = 'C:/Users/Lenovo/ego/purchase-in-source-20261111'
await fs.mkdir(OUT, { recursive: true })

const task = await taskSpace('purchase-in-source-20261111')
const page = task.page('p1')

async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: OUT + '/' + name })
  console.log('shot=' + name)
}

// 1) 刚由检验审核自动生成的入库单(zh)
await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=PI-2026-11-0001', { timeout: 40000 })
await page.waitForTimeout(4000)
const zh = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.udl-fields .field')].slice(-3).map((el) => ({
    label: (el.querySelector('label')?.innerText || '').replace(/\s+/g, ' ').trim(),
    value: el.querySelector('input, textarea')?.value || '',
  }))
  return { title: (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '), tail: fields }
})
console.log('zh=' + JSON.stringify(zh))
await shot('r16-new-pi-zh.png')

// 2) 切英文,看显示名(多语言红线:只换显示名)
await page.evaluate(() => {
  const sels = [...document.querySelectorAll('.el-select, .lang-switch, [class*=lang]')]
  const hit = sels.find((s) => /中|简/.test((s.innerText || '').trim()) && (s.innerText || '').trim().length <= 8)
  if (hit) hit.click()
})
await page.waitForTimeout(900)
let langs = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')]
  .filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').trim()))
console.log('langs=' + JSON.stringify(langs))
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter((e) => e.offsetParent !== null)
  const en = items.find((e) => /English/i.test(e.innerText || ''))
  if (en) { en.click(); return (en.innerText || '').trim() }
  return null
})
console.log('pickedLang=' + picked)
await page.waitForTimeout(3000)

await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=PI-2026-11-0001', { timeout: 40000 })
await page.waitForTimeout(4000)
const en = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.udl-fields .field')].slice(-3).map((el) => ({
    label: (el.querySelector('label')?.innerText || '').replace(/\s+/g, ' ').trim(),
    value: el.querySelector('input, textarea')?.value || '',
  }))
  return { title: (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '), tail: fields }
})
console.log('en=' + JSON.stringify(en))
await shot('r17-new-pi-en.png')
