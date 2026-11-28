// round-14:补看「部分已添加」——删掉第二张单里的一行后重开选单:该单应为 部分已添加,只有那一行不灰
const task = await taskSpace('merge-pick-rows-20261128')
const page = task.page('p1')
const shot = (n) => page.screenshot({ path: `C:/Users/Lenovo/ego/merge-pick-rows-20261128/round-14-${n}.png` })
const restore = async () => {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.evaluate(() => {
  const ins = [...document.querySelectorAll('input')]
  const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (!acc || !pwd) return
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  setVal(acc, 'admin')
  setVal(pwd, '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(5000)
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 30000 })
await page.waitForTimeout(6000)
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((el) => /生单/.test((el.querySelector('.act-name') || {}).textContent || ''))
  const caret = g && (g.querySelector('.tb-caret') || g.querySelector('.tb-main'))
  if (caret) caret.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('body *')].filter((x) => (x.textContent || '').trim() === '合单生单' && x.children.length === 0)[0]
  const target = el && (el.closest('li, .tb-item, [class*="item"]') || el)
  if (target) target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(4500)

// 供应商收窄到 无锡安吉(两张单)
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const inp = [...box.querySelectorAll('.mpd-bar input')].find((i) => (i.placeholder || '') === '供应商')
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '无锡安吉')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
})
await page.waitForTimeout(400)
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  ;[...box.querySelectorAll('.mpd-bar button')].find((b) => (b.textContent || '').includes('查询')).click()
})
await page.waitForTimeout(3000)

const checkDoc = (no) => page.evaluate((wanted) => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const tr = [...box.querySelectorAll('.el-table__body tbody tr')].find((r) => {
    const tds = [...r.querySelectorAll('td')]
    return Number(tds[0] && tds[0].getAttribute('rowspan') || 0) > 0 && (tds[2].textContent || '').trim() === wanted
  })
  const input = tr && tr.querySelector('td .el-checkbox input')
  if (!input) return 'no-input'
  input.click()
  return 'ok'
}, no)

console.log('A=' + await checkDoc('YJ-20261120-07'))
await page.waitForTimeout(800)
console.log('B=' + await checkDoc('YJ-20261120-01'))
await page.waitForTimeout(800)
console.log('join=' + await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const btn = [...box.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('加入合单'))
  if (!btn || btn.disabled) return 'disabled'
  btn.click()
  return 'ok'
}))
await page.waitForTimeout(5000)
await restore()

// 删**第二张单**(YJ-20261120-01,5 行)的第一行:点它表格里的第一个 ✕
console.log('del2=' + await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /合单生单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const docs = [...box.querySelectorAll('.gl-doc')]
  const d2 = docs.find((d) => (d.querySelector('.gl-doc-no') || {}).textContent === 'YJ-20261120-01') || docs[1]
  const x = d2 && d2.querySelector('.gl-x')
  if (!x) return 'no-x'
  x.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return 'ok:' + ((d2.querySelector('.gl-doc-no') || {}).textContent || '')
}))
await page.waitForTimeout(1500)
console.log('pick=' + await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /合单生单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const btn = box && [...box.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '选择单据')
  if (!btn) return 'no-btn'
  btn.click()
  return 'ok'
}))
await page.waitForTimeout(4000)
await restore()

const st = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  if (!box) return { found: false }
  const trs = [...box.querySelectorAll('.el-table__body tbody tr')]
  return {
    found: true,
    tags: [...box.querySelectorAll('.el-table__body .el-tag')].map((t) => (t.textContent || '').trim()),
    grey: trs.filter((tr) => tr.className.includes('mpd-added-line')).length,
    total: trs.length,
    rows: trs.map((tr) => (tr.className.includes('mpd-added-line') ? '[灰]' : '[--]') + ' ' + [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ')),
  }
})
console.log('status=' + JSON.stringify(st, null, 1))
await shot('partial')
await task.finish({ keep: [] })
