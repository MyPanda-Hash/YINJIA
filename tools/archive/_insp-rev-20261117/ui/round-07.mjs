// round-07: 手工改编号 → 保存 → 看提示与回读
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

// 1) 找出所有可见按钮(定位「保存」)
const btns = await page.evaluate(() => [...document.querySelectorAll('button')]
  .filter((b) => b.offsetParent)
  .map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim())
  .filter(Boolean)
  .slice(0, 40))
console.log('buttons=' + JSON.stringify(btns))

// 2) 改编号
const renamed = await page.evaluate(() => {
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
console.log('rename=' + renamed)
await T(600)

// 3) 保存
const saved = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].filter((b) => b.offsetParent)
    .find((b) => (b.textContent || '').replace(/\s+/g, '') === '保存')
  if (!btn) return 'no-save-btn'
  btn.click()
  return 'clicked'
})
console.log('save=' + saved)
await T(6000)

const res = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  return {
    msg: [...document.querySelectorAll('.el-message, .el-message-box')].map((m) => txt(m)).join(' | '),
    meta: txt(sheet?.querySelector('.ic-meta')),
    metaInputs: [...(sheet?.querySelectorAll('.ic-meta input') || [])].map((i) => i.value),
    items: sheet?.querySelectorAll('.ic-items tbody tr').length,
    status: txt(document.querySelector('.approval-side')),
  }
})
console.log(JSON.stringify(res, null, 2))
await page.screenshot({ path: dir + '/shots/round-07-saved.png' })
