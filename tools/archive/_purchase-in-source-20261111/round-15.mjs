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

// ---------- 表单页:字段已撤掉,提示挂在单号旁 ----------
await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=PI-2026-11-0001', { timeout: 40000 })
await page.waitForTimeout(4500)
const form = await page.evaluate(() => ({
  hash: location.hash,
  labels: [...document.querySelectorAll('.udl-fields .field label')].map((e) => (e.innerText || '').trim()),
  chip: (() => {
    const c = document.querySelector('.title .doc-source')
    return c ? { text: (c.innerText || '').replace(/\s+/g, ' ').trim(), title: c.getAttribute('title'), clickable: c.className } : null
  })(),
}))
console.log('form=' + JSON.stringify(form, null, 1))
await shot('r20-form-hint.png')

// ---------- 点提示 → 跳来源单据 ----------
if (form.chip) {
  await page.click('.title .doc-source', { label: '点击来源提示' })
  await page.waitForTimeout(5000)
  const jumped = await page.evaluate(() => ({
    hash: location.hash,
    title: (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '),
  }))
  console.log('jumped=' + JSON.stringify(jumped))
  await shot('r21-jump-source.png')
}

// ---------- 列表页表头条上的提示 ----------
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.waitForTimeout(4500)
const list = await page.evaluate(() => ({
  hash: location.hash,
  docChip: (document.querySelector('.tools-right .doc-chip')?.innerText || '').replace(/\s+/g, ' ').trim(),
  chip: (() => {
    const c = document.querySelector('.tools-right .doc-source')
    return c ? { text: (c.innerText || '').replace(/\s+/g, ' ').trim(), title: c.getAttribute('title'), cls: c.className } : null
  })(),
  firstRows: [...document.querySelectorAll('.el-table__body tbody tr')].slice(0, 3)
    .map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60)),
}))
console.log('list=' + JSON.stringify(list, null, 1))
await shot('r22-list-hint.png')
