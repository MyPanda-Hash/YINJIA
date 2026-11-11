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

async function readChip(sel) {
  return await page.evaluate((s) => {
    const c = document.querySelector(s)
    if (!c) return null
    const st = getComputedStyle(c)
    return { hint: (c.innerText || '').replace(/\s+/g, ' ').trim(), hover: c.getAttribute('title'),
      cursor: st.cursor, bg: st.backgroundColor, color: st.color }
  }, sel)
}

// ① 有来源(绿)
await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=PI-2026-11-0001', { timeout: 40000 })
await page.reload()
await page.waitForTimeout(6500)
console.log('有来源=' + JSON.stringify(await readChip('.title .doc-source')))
await shot('r35-with-source.png')

// ② 没有上游单据(灰)
await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=CGRK-20261014-03407', { timeout: 40000 })
await page.reload()
await page.waitForTimeout(6500)
console.log('无上游=' + JSON.stringify(await readChip('.title .doc-source')))
await shot('r36-no-upstream.png')

const ARCH = 'D:/YINJIA-main/tools/archive/_purchase-in-source-20261111'
for (const f of await fs.readdir(OUT)) await fs.copyFile(OUT + '/' + f, ARCH + '/' + f)
console.log('archived=ok')
