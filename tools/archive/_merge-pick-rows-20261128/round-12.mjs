// round-12:选单窗改版实测 —— ①分行/列宽/状态 ②勾两张 → 加入合单 ③合单页删一行 → 再选单看「部分已添加」+ 灰显
const task = await taskSpace('merge-pick-rows-20261128')
const page = task.page('p1')
const shot = (n) => page.screenshot({ path: `C:/Users/Lenovo/ego/merge-pick-rows-20261128/round-12-${n}.png` })
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
await restore()

// ① 分行 / 列宽 / 状态
const snap = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')]
    .find((d) => d.offsetParent !== null && /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  if (!box) return { found: false }
  const wrap = box.querySelector('.el-table__body-wrapper')
  const ths = [...box.querySelectorAll('.el-table__header th')]
  const trs = [...box.querySelectorAll('.el-table__body tbody tr')]
  return {
    found: true,
    cols: ths.map((th) => `${(th.textContent || '').trim()}:${Math.round(th.getBoundingClientRect().width)}`),
    overflow: wrap ? wrap.scrollWidth - wrap.clientWidth : -1,
    lastThRight: Math.round(ths[ths.length - 1].getBoundingClientRect().right),
    tableRight: Math.round(wrap.getBoundingClientRect().right),
    rows: trs.slice(0, 8).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ')),
    foot: ((box.querySelector('.el-dialog__footer') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
  }
})
console.log('① cols=' + JSON.stringify(snap.cols))
console.log('① overflow=' + snap.overflow + ' lastThRight=' + snap.lastThRight + ' tableRight=' + snap.tableRight)
for (const r of snap.rows || []) console.log('  ' + r)
await shot('a-first')

// ② 勾第一张(点复选框内层,避免 label 双触发) → 等供应商收窄 → 再勾同一家的第二张
const clickDocBox = (n) => page.evaluate((idx) => {
  const box = [...document.querySelectorAll('.el-dialog')]
    .find((d) => d.offsetParent !== null && /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const trs = box.querySelectorAll('.el-table__body tbody tr')
  const tr = trs[idx]
  if (!tr) return 'no-row'
  const inner = tr.querySelector('td .el-checkbox__inner') || tr.querySelector('td .el-checkbox input') || tr.querySelector('td .el-checkbox')
  if (!inner) return 'no-box'
  inner.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return 'ok'
}, n)
console.log('② pick1=' + await clickDocBox(0))
await page.waitForTimeout(3000)
console.log('② 收窄后=' + JSON.stringify(await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const chips = [...box.querySelectorAll('.mpd-bar .mpd-chip')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
  const trs = [...box.querySelectorAll('.el-table__body tbody tr')]
  return { chips, rows: trs.length, first: [...(trs[0] ? trs[0].querySelectorAll('td') : [])].map((td) => (td.textContent || '').trim()) }
})))
console.log('② pick2=' + await clickDocBox(0))
await page.waitForTimeout(1200)
console.log('② footer=' + JSON.stringify(await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  return ((box.querySelector('.el-dialog__footer') || {}).textContent || '').replace(/\s+/g, ' ').trim()
})))
await shot('b-two-picked')

// 加入合单
console.log('③ 加入合单=' + await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const btn = [...box.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('加入合单'))
  if (!btn || btn.disabled) return 'disabled'
  btn.click()
  return 'ok'
}))
await page.waitForTimeout(5000)
await restore()
console.log('③ 合单页=' + JSON.stringify(await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /合单生单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  if (!box) return { found: false, titles: [...document.querySelectorAll('.el-dialog__title')].map((t) => (t.textContent || '').trim()) }
  return {
    found: true,
    docs: [...box.querySelectorAll('.gl-doc')].map((d) => ({
      no: (d.querySelector('.gl-doc-no') || {}).textContent,
      rows: d.querySelectorAll('.el-table__body tbody tr').length,
    })),
  }
})))
await shot('c-merge-page')

// ④ 删一行 → 再点「选择单据」→ 状态应为 部分已添加 / 已添加,且已加入的行灰显
console.log('④ 删一行=' + await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /合单生单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const x = box && box.querySelector('.gl-x')
  if (!x) return 'no-x'
  x.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return 'ok'
}))
await page.waitForTimeout(1200)
console.log('④ 打开选单=' + await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /合单生单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  const btn = box && [...box.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '选择单据')
  if (!btn) return 'no-btn'
  btn.click()
  return 'ok'
}))
await page.waitForTimeout(4000)
await restore()
console.log('④ 状态=' + JSON.stringify(await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')]
    .filter((d) => d.offsetParent !== null)
    .find((d) => /选择采购订单/.test((d.querySelector('.el-dialog__title') || {}).textContent || ''))
  if (!box) return { found: false }
  const trs = [...box.querySelectorAll('.el-table__body tbody tr')]
  return {
    found: true,
    greyRows: trs.filter((tr) => tr.className.includes('mpd-added-line')).length,
    rows: trs.slice(0, 10).map((tr) => {
      const tds = [...tr.querySelectorAll('td')]
      return `${tr.className.includes('mpd-added-line') ? '[灰]' : '[  ]'} ` + tds.map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ')
    }),
  }
}, null, 1)))
await shot('d-partial')
await task.finish({ keep: [] })
