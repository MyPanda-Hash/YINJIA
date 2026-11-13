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

const docs = [
  ['PI-2026-10-0108', 'r04-recv.png'],
  ['PI-2026-10-0105', 'r05-insp.png'],
]
for (const [no, png] of docs) {
  await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=' + no, { timeout: 40000 })
  await page.waitForTimeout(4000)
  const data = await page.evaluate(() => {
    const fields = [...document.querySelectorAll('.udl-fields .field')].map((el) => {
      const label = (el.querySelector('label')?.innerText || '').replace(/\s+/g, ' ').trim()
      const inp = el.querySelector('input, textarea')
      return { label, value: inp ? inp.value : '' }
    })
    return { hash: location.hash, count: fields.length, fields }
  })
  console.log('=== ' + no + ' ===')
  console.log(JSON.stringify(data, null, 1))
  await shot(png)
}
