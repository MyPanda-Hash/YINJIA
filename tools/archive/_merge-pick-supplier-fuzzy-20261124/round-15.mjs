// round-15:验收**打包版 8090**(jar 内 static + 新后端):模糊搜索 + 勾一张只剩同一供应商
const task = await taskSpace('merge-8090-verify-20261124')
const page = task.page('p1')
const log = (...a) => console.log(...a)

const snap = () => page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  if (!d) return { ok: false, titles: [...document.querySelectorAll('.el-dialog')].filter((x) => x.offsetParent !== null).map((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim()) }
  const rows = [...d.querySelectorAll('.el-table__body tbody tr')].map((tr) => {
    const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
    return { no: tds[2], supplier: tds[4], items: tds[5], picked: !!tr.querySelector('.el-checkbox__input.is-checked') }
  })
  return { ok: true, count: rows.length, suppliers: [...new Set(rows.map((r) => r.supplier))], rows: rows.slice(0, 4), picked: (d.querySelector('.mpd-picked')?.textContent || '').replace(/\s+/g, ' ').trim() }
})

await page.goto('http://127.0.0.1:8090/#/panelx/list/PU_ORDER', { timeout: 90000 })
await page.waitForTimeout(9000)
const loggedIn = await page.evaluate(() => !!document.querySelector('.login-submit'))
if (loggedIn) {
  log('需要登录')
  await page.evaluate(() => {
    const set = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    set(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    set(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  })
  await page.waitForTimeout(500)
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))?.click())
  await page.waitForTimeout(8000)
  await page.goto('http://127.0.0.1:8090/#/panelx/list/PU_ORDER', { timeout: 90000 })
  await page.waitForTimeout(8000)
}

await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '生单')
  if (g && !document.querySelector('.tb-menu')) g.querySelector('.tb-caret')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(900)
await page.evaluate(() => {
  ;[...document.querySelectorAll('.tb-menu .ctx-item')].find((e) => (e.textContent || '').trim() === '合单生单')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(5000)
log('OPEN', JSON.stringify(await snap()))

// 模糊搜「端盖」
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const box = [...d.querySelectorAll('.mpd-bar input')].find((i) => (i.placeholder || '').startsWith('关键字'))
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(box, '端盖')
  box.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.waitForTimeout(200)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  ;[...d.querySelectorAll('.mpd-bar button')].find((b) => (b.textContent || '').includes('查询'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(3000)
log('KW端盖', JSON.stringify(await snap()))

// 勾第一张 → 应只剩同一供应商
const first = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  const tr = d.querySelector('.el-table__body tbody tr')
  const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
  tr.querySelector('td:nth-child(3)')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { no: tds[2], supplier: tds[4] }
})
await page.waitForTimeout(3000)
log('PICK', JSON.stringify(first), JSON.stringify(await snap()))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-8090-verify-20261124/round-15-8090.png' })

await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  ;[...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('取消'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1000)
await task.finish({ keep: [] })
log('done round-15')
