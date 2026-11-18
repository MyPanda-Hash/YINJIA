// round-09: 版面复核 + 重号查重(新增第二张 → 改成已存在的号 → 保存应被拒)
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

// 打开已保存的那张,复核版面(勾选项是否还竖排)
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await T(6000)
const wrapCheck = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const rows = [...sheet.querySelectorAll('tbody > tr')].slice(0, 3)
    .map((tr) => [...tr.querySelectorAll('.ic-opt-text')].map((e) => {
      const r = e.getBoundingClientRect()
      return { t: (e.textContent || '').trim(), h: Math.round(r.height), w: Math.round(r.width) }
    }))
  return { rows }
})
console.log('wrap=' + JSON.stringify(wrapCheck))
await page.screenshot({ path: dir + '/shots/round-09-layout.png' })

// 新增第二张草稿
const add2 = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '新增')
  if (!btn) return 'no-btn'
  btn.click()
  return 'clicked'
})
console.log('add2=' + add2)
await T(7000)

// 改成本月已存在的号
const setNo = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const inp = [...sheet.querySelectorAll('.ic-meta input')].find((i) => /^WT-/.test(i.value))
  if (!inp) return 'no-input'
  const old = inp.value
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, 'WT-2026-11-9001')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  return old + '->' + inp.value
})
console.log('setNo=' + setNo)
await T(500)

// 先带入 1 行明细(保存要求至少一行),再点保存
const carry = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('选择检验项目'))
  if (!btn) return 'no-btn'
  btn.click()
  return 'opened'
})
await T(4000)
const picked = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent)
  const row = dlg?.querySelector('.el-table__body tr')
  const cb = row?.querySelector('.el-checkbox')
  if (cb) cb.click()
  const btn = [...(dlg?.querySelectorAll('button') || [])].find((b) => /带入/.test(b.textContent || ''))
  if (btn) btn.click()
  return { carry: carry, row: !!row, confirm: !!btn }
})
console.log('carry=' + JSON.stringify(picked))
await T(3500)

const save = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '保存')
  if (!btn) return 'no-save'
  btn.click()
  return 'clicked'
})
console.log('save=' + save)
await T(6000)

const res = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  return {
    msg: [...document.querySelectorAll('.el-message, .el-message-box, .el-notification, .el-form-item__error')].map((m) => txt(m)).join(' | '),
    metaInputs: [...(sheet?.querySelectorAll('.ic-meta input') || [])].map((i) => i.value),
    items: sheet?.querySelectorAll('.ic-items tbody tr').length,
  }
})
console.log(JSON.stringify(res, null, 2))
await page.screenshot({ path: dir + '/shots/round-09-dup-rejected.png' })
