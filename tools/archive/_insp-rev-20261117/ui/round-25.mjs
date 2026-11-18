// round-25: 送样人 >15 人 ⇒ 弹窗查找(纸面只显示已选姓名 + 选择按钮)
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1000 } })
  }
  await T(400)
} catch (e) { console.log('resize skip: ' + e.message) }

await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await T(7000)

const added = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '新增')
  if (!btn) return 'no-btn'
  btn.click()
  return 'clicked'
})
console.log('add=' + added)
await T(8000)

const cell = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test(txt(r)))
  return {
    cell: txt(tr),
    hasSelect: !!tr.querySelector('.el-select'),
    hasPickBtn: !!tr.querySelector('.ic-pick-btn'),
    docNo: [...sheet.querySelectorAll('.ic-meta input')].map((i) => i.value),
  }
})
console.log('cell=' + JSON.stringify(cell))

// 打开弹窗
const opened = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test((r.textContent || '')))
  const btn = tr.querySelector('.ic-pick-btn')
  if (!btn) return 'no-btn'
  btn.click()
  return 'clicked'
})
console.log('open=' + opened)
await T(1500)

const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const d = [...document.querySelectorAll('.ic-contact-dialog')].find((x) => x.offsetParent)
  const items = [...(d?.querySelectorAll('.ic-contact-item') || [])].map((i) => txt(i))
  return { visible: !!d, title: txt(d?.querySelector('.el-dialog__title')), count: items.length, head: items.slice(0, 6) }
})
console.log('dialog=' + JSON.stringify(dlg))
await page.screenshot({ path: dir + '/shots/round-25-contact-dialog.png' })

// 搜索「陈」
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.ic-contact-dialog')].find((x) => x.offsetParent)
  const inp = d.querySelector('input')
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '陈')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await T(900)
const searched = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.ic-contact-dialog')].find((x) => x.offsetParent)
  const items = [...d.querySelectorAll('.ic-contact-item')].map((i) => (i.textContent || '').trim())
  return { count: items.length, items }
})
console.log('search=' + JSON.stringify(searched))

// 选第一个
const picked = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.ic-contact-dialog')].find((x) => x.offsetParent)
  const first = d.querySelector('.ic-contact-item')
  const label = (first.textContent || '').trim()
  first.click()
  return label
})
console.log('picked=' + picked)
await T(1200)

const after = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test(txt(r)))
  return {
    cell: txt(tr),
    dialogOpen: [...document.querySelectorAll('.ic-contact-dialog')].some((x) => x.offsetParent),
  }
})
console.log('after=' + JSON.stringify(after))
await page.screenshot({ path: dir + '/shots/round-25-picked.png' })
