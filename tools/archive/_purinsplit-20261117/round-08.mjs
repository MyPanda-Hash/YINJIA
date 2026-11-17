const task = await taskSpace('purin-whpick-20261117')
const page = task.page('p1')

// 1) 登录测试库
await page.goto('http://localhost:5173/#/login', { timeout: 60000 })
await page.waitForTimeout(2500)
await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const sel = [...document.querySelectorAll('.el-select')].find((s) => (s.textContent || '').includes('YINJIA-MES'))
  sel?.querySelector('.el-select__wrapper, input')?.click()
  await sleep(600)
  const target = [...document.querySelectorAll('.el-select-dropdown__item')].find((o) => (o.textContent || '').includes('测试库'))
  target?.click()
  await sleep(300)
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('登录账号')), 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('登录密码')), '123456')
  ;[...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))?.click()
})
await page.waitForTimeout(7000)

// 2) 直接打开单据
await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=PI-2026-11-0008', { timeout: 60000 })
await page.waitForTimeout(7000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

// 3) 点仓库格 → 勾两仓 → 平均分配 → 确定(一次 evaluate 内完成,避免会话中途过期)
const out = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const rows0 = [...document.querySelectorAll('.detail .el-table__body-wrapper tr.el-table__row')].filter(vis)
  if (!rows0.length) return { err: 'no-detail-row', hash: location.hash }
  const heads = [...document.querySelectorAll('.detail .el-table__header-wrapper th')].map((th) => (th.textContent || '').trim())
  const idx = heads.indexOf('仓库')
  rows0[0].querySelectorAll('td')[idx]?.querySelector('.ref-cell')?.click()
  await sleep(2600)
  const dlg = () => [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const items = [...dlg().querySelectorAll('.pwp-item')]
  const pick = (name) => {
    const it = items.find((d) => (d.querySelector('.pwp-name')?.textContent || '').trim() === name)
    it?.querySelector('.el-checkbox')?.click()
  }
  pick('恒亿仓')
  await sleep(250)
  pick('成品B仓')
  await sleep(350)
  const evenBtn = [...dlg().querySelectorAll('button')].find((b) => (b.textContent || '').includes('平均分配'))
  evenBtn?.click()
  await sleep(500)
  const sumText = (dlg().querySelector('.pwp-sum')?.textContent || '').replace(/\s+/g, ' ').trim()
  const hint = (dlg().querySelector('.pwp-hint')?.textContent || '').trim()
  const okBtn = [...dlg().querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定')
  const disabled = okBtn?.disabled
  const qtys = [...dlg().querySelectorAll('.el-input-number input')].map((i) => i.value).filter((v) => v && v !== '')
  if (!disabled) { okBtn.click() }
  await sleep(7000)
  const rows1 = [...document.querySelectorAll('.detail .el-table__body-wrapper tr.el-table__row')].filter(vis)
  return {
    sumText, hint, disabled, qtys,
    msg: [...document.querySelectorAll('.el-message')].filter(vis).map((m) => (m.textContent || '').trim()),
    rowCount: rows1.length,
    rows: rows1.map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70)),
  }
})
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-whpick-20261117/g6-after-split.png' })
