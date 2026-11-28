// round-13:真勾选(input.click 才触发 change) → 加入合单 → 合单页删一行 → 再选单看「部分已添加」+ 灰显
const task = await taskSpace('merge-pick-rows-20261128')
const page = task.page('p1')
const shot = (n) => page.screenshot({ path: `C:/Users/Lenovo/ego/merge-pick-rows-20261128/round-13-${n}.png` })
const restore = async () => {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
const pickBox = () => `[...document.querySelectorAll('.el-dialog')]
  .filter((d) => d.offsetParent !== null)
  .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))`

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

// 按供应商收窄(无锡安吉有两张单,正好够合单两张)
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const inp = [...box.querySelectorAll('.mpd-bar input')].find((i) => (i.placeholder || '') === '供应商')
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '无锡安吉')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
})
await page.waitForTimeout(500)
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const btn = [...box.querySelectorAll('.mpd-bar button')].find((b) => (b.textContent || '').includes('查询'))
  btn.click()
})
await page.waitForTimeout(3000)
await restore()

const docList = async () => page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  if (!box) return { found: false }
  const trs = [...box.querySelectorAll('.el-table__body tbody tr')]
  const docs = trs.map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    const span = Number(tds[0] && tds[0].getAttribute('rowspan') || 0)
    return span ? { no: (tds[2].textContent || '').trim(), lines: span, checked: !!(tr.querySelector('td .el-checkbox input') || {}).checked } : null
  }).filter(Boolean)
  return { found: true, docs, foot: ((box.querySelector('.el-dialog__footer') || {}).textContent || '').replace(/\s+/g, ' ').trim() }
})
console.log('docList=' + JSON.stringify(await docList()))

// 勾一张:直接点 input(合成点击能触发 change;点 .el-checkbox__inner 不会)
const checkDoc = (no) => page.evaluate((wanted) => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const trs = [...box.querySelectorAll('.el-table__body tbody tr')]
  const tr = trs.find((r) => {
    const tds = [...r.querySelectorAll('td')]
    return Number(tds[0] && tds[0].getAttribute('rowspan') || 0) > 0 && (tds[2].textContent || '').trim() === wanted
  })
  if (!tr) return 'no-row'
  const input = tr.querySelector('td .el-checkbox input')
  if (!input) return 'no-input'
  input.click()
  return 'ok'
}, no)

const docs = (await docList()).docs || []
console.log('pick A=' + await checkDoc(docs[0].no))
await page.waitForTimeout(1200)
console.log('after A=' + JSON.stringify(await docList()))
console.log('pick B=' + await checkDoc(docs[1].no))
await page.waitForTimeout(1000)
console.log('after B=' + JSON.stringify(await docList()))
await shot('a-picked2')

// 加入合单
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
const mergeState = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /合单生单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  if (!box) return { found: false, titles: [...document.querySelectorAll('.el-dialog__title')].map((t) => (t.textContent || '').trim()) }
  return {
    found: true,
    docs: [...box.querySelectorAll('.gl-doc')].map((d) => ({
      no: (d.querySelector('.gl-doc-no') || {}).textContent,
      rows: d.querySelectorAll('.el-table__body tbody tr').length,
    })),
  }
})
console.log('merge=' + JSON.stringify(mergeState))
await shot('b-merge')

// 删掉第一张单的第一行 → 再选单
console.log('del=' + await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
    .find((d) => /合单生单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const x = box && box.querySelector('.gl-x')
  if (!x) return 'no-x'
  x.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return 'ok'
}))
await page.waitForTimeout(1500)
console.log('open-pick=' + await page.evaluate(() => {
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
    chips: [...box.querySelectorAll('.mpd-bar .mpd-chip')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
    rows: trs.slice(0, 12).map((tr) => {
      const tds = [...tr.querySelectorAll('td')]
      return (tr.className.includes('mpd-added-line') ? '[灰]' : '[--]') + ' ' + tds.map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ')
    }),
  }
})
console.log('status=' + JSON.stringify(st, null, 1))
await shot('c-partial')
await task.finish({ keep: [] })
