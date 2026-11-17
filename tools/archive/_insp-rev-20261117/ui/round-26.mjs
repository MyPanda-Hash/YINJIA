// round-26: 弹窗选「陈秀丽」→ 补必填 → 保存 → 等数据库复核
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

// 1) 弹窗里选「陈秀丽」
await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test(r.textContent || ''))
  tr?.querySelector('.ic-pick-btn')?.click()
})
await T(1200)
const picked = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.ic-contact-dialog')].find((x) => x.offsetParent)
  const item = [...(d?.querySelectorAll('.ic-contact-item') || [])].find((i) => (i.textContent || '').trim() === '陈秀丽')
  if (!item) return 'not-found'
  item.click()
  return 'ok'
})
console.log('pick=' + picked)
await T(1000)

// 2) 补必填:样品名称 / 样品数量 / 样品型号规格(滤芯)
const filled = await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const sheet = document.querySelector('[data-ic-sheet]')
  const rows = [...sheet.querySelectorAll('tbody > tr')]
  const rowOf = (k) => rows.find((r) => (r.textContent || '').includes(k))
  const nameIn = rowOf('样品名称')?.querySelector('input')
  if (nameIn) setVal(nameIn, '净水器滤芯')
  const qtyIn = rowOf('样品数量')?.querySelector('input')
  if (qtyIn) setVal(qtyIn, '3支')
  const kind = rowOf('样品型号/规格')?.querySelector('.ic-opt')
  if (kind) kind.click()
  return { name: !!nameIn, qty: !!qtyIn, kind: !!kind }
})
console.log('filled=' + JSON.stringify(filled))
await T(600)

// 3) 带入 1 行明细
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('选择检验项目'))
  if (btn) btn.click()
})
await T(4200)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent && !d.classList.contains('ic-contact-dialog'))
  const row = dlg?.querySelector('.el-table__body tr')
  row?.querySelector('.el-checkbox')?.click()
})
await T(900)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent && !d.classList.contains('ic-contact-dialog'))
  const btn = [...(dlg?.querySelectorAll('button') || [])].find((b) => /带入/.test(b.textContent || ''))
  if (btn) btn.click()
})
await T(3500)

// 4) 保存
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '保存')
  if (btn) btn.click()
})
await T(7000)

const res = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  const rows = [...sheet.querySelectorAll('tbody > tr')]
  const cell = (k) => txt(rows.find((r) => (r.textContent || '').includes(k)))
  return {
    contact: cell('联系人'),
    name: cell('样品名称'),
    qty: cell('样品数量'),
    kind: cell('样品型号/规格'),
    docNo: [...sheet.querySelectorAll('.ic-meta input')].map((i) => i.value),
    box: (() => { const b = document.querySelector('.el-message-box'); return b ? txt(b).slice(0, 160) : '' })(),
  }
})
console.log(JSON.stringify(res, null, 2))
await page.screenshot({ path: dir + '/shots/round-26-saved.png' })
