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

// 表单页直接开一张「ERP 单号形态、没有上游单据」的老单
await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=CGRK-20261014-03407', { timeout: 40000 })
await page.reload()
await page.waitForTimeout(6500)
const noSrc = await page.evaluate(() => {
  const c = document.querySelector('.title .doc-source')
  return {
    title: (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '),
    hint: c ? (c.innerText || '').replace(/\s+/g, ' ').trim() : null,
    hover: c ? c.getAttribute('title') : null,
    cursor: c ? getComputedStyle(c).cursor : null,
    labels: [...document.querySelectorAll('.udl-fields .field label')].map((e) => (e.innerText || '').trim()).slice(-3),
  }
})
console.log('无上游=' + JSON.stringify(noSrc, null, 1))
await shot('r33-form-no-upstream.png')

// 列表页:点第 3 行选中它(按行序号),确认同一文案
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.reload()
await page.waitForTimeout(6000)
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  const target = rows.find((tr) => /CGRK-20261014-03407/.test(tr.textContent || ''))
  if (!target) return { ok: false, sample: rows.slice(0, 3).map((r) => (r.textContent || '').slice(0, 40)) }
  target.click()
  return { ok: true }
})
console.log('picked=' + JSON.stringify(picked))
await page.waitForTimeout(4000)
const listChip = await page.evaluate(() => {
  const c = document.querySelector('.tools-right .doc-source')
  return {
    docChip: (document.querySelector('.tools-right .doc-chip')?.innerText || '').replace(/\s+/g, ' ').trim(),
    hint: c ? (c.innerText || '').replace(/\s+/g, ' ').trim() : null,
    hover: c ? c.getAttribute('title') : null,
  }
})
console.log('listChip=' + JSON.stringify(listChip, null, 1))
await shot('r34-list-no-upstream.png')

const ARCH = 'D:/YINJIA-main/tools/archive/_purchase-in-source-20261111'
for (const f of await fs.readdir(OUT)) await fs.copyFile(OUT + '/' + f, ARCH + '/' + f)
console.log('archived=ok')
