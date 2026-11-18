// round-28: 按行内输入框顺序填(样品名称/商标/样品数量)→ 保存 → 落库
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

const fixed = await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const sheet = document.querySelector('[data-ic-sheet]')
  const rows = [...sheet.querySelectorAll('tbody > tr')]
  const tr = rows.find((r) => /样品名称/.test(r.textContent || ''))
  const ins = [...tr.querySelectorAll('input')]
  if (ins[0]) setVal(ins[0], '净水器滤芯')
  if (ins[2]) setVal(ins[2], '3支')
  return { count: ins.length, values: ins.map((i) => i.value) }
})
console.log('fixed=' + JSON.stringify(fixed))
await T(800)

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '保存')
  if (btn) btn.click()
})
await T(8000)

const res = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  return {
    box: (() => { const b = document.querySelector('.el-message-box'); return b ? txt(b).slice(0, 160) : '' })(),
    row: txt([...sheet.querySelectorAll('tbody > tr')].find((r) => /样品名称/.test(txt(r)))),
    contact: txt([...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test(txt(r)))),
    docNo: [...sheet.querySelectorAll('.ic-meta input')].map((i) => i.value),
  }
})
console.log(JSON.stringify(res, null, 2))
await page.screenshot({ path: dir + '/shots/round-28-saved.png' })
