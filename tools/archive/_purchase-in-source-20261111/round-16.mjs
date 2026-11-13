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

// 先装一个错误收集器(SPA 内部跳转不会清掉 window),再走前端路由进入表单页
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.waitForTimeout(3500)
await page.evaluate(() => {
  window.__errs = []
  window.addEventListener('error', (e) => window.__errs.push('error: ' + (e.message || e)))
  window.addEventListener('unhandledrejection', (e) => window.__errs.push('reject: ' + (e.reason?.message || e.reason)))
})
await page.evaluate(() => { location.hash = '#/panelx/form/PURCHASE_IN?code=PI-2026-11-0001' })
await page.waitForTimeout(6000)

const info = await page.evaluate(() => ({
  hash: location.hash,
  errs: window.__errs || [],
  labels: [...document.querySelectorAll('.udl-fields .field label')].map((e) => (e.innerText || '').trim()),
  title: (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '),
  chip: (() => {
    const c = document.querySelector('.title .doc-source')
    return c ? { text: (c.innerText || '').replace(/\s+/g, ' ').trim(), title: c.getAttribute('title'), cls: c.className } : null
  })(),
  toasts: [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').trim()),
}))
console.log('form=' + JSON.stringify(info, null, 1))
await shot('r23-form-hint.png')

if (info.chip) {
  await page.click('.title .doc-source', { label: '点击来源提示' })
  await page.waitForTimeout(5000)
  const jumped = await page.evaluate(() => ({
    hash: location.hash,
    title: (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '),
    errs: window.__errs || [],
  }))
  console.log('jumped=' + JSON.stringify(jumped))
  await shot('r24-jump-source.png')
}
