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

// 表单页(独立打开的单据页):字段同样撤掉,提示在单号旁
await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=PI-2026-11-0001', { timeout: 40000 })
await page.reload()
await page.waitForTimeout(6500)
const form = await page.evaluate(() => ({
  hash: location.hash,
  labels: [...document.querySelectorAll('.udl-fields .field label')].map((e) => (e.innerText || '').trim()),
  title: (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '),
  chip: (() => {
    const c = document.querySelector('.title .doc-source')
    return c ? { text: (c.innerText || '').replace(/\s+/g, ' ').trim(), title: c.getAttribute('title'), cls: c.className } : null
  })(),
}))
console.log('form=' + JSON.stringify(form, null, 1))
await shot('r27-form-hint.png')
