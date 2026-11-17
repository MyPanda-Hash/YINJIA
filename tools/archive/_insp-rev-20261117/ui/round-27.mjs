// round-27: 正确填「样品数量」后保存,落库验证联系人=陈秀丽
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
  const ins = [...sheet.querySelectorAll('input')]
  const qty = ins.find((i) => (i.placeholder || '') === '样品数量')
  const name = ins.find((i) => (i.placeholder || '') === '样品名称')
  if (name) setVal(name, '净水器滤芯')
  if (qty) setVal(qty, '3支')
  return { name: name?.value, qty: qty?.value }
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
    box: (() => { const b = document.querySelector('.el-message-box'); return b ? txt(b).slice(0, 200) : '' })(),
    contact: txt([...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test(txt(r)))),
    docNo: [...sheet.querySelectorAll('.ic-meta input')].map((i) => i.value),
    items: sheet.querySelectorAll('.ic-items tbody tr').length,
  }
})
console.log(JSON.stringify(res, null, 2))
await page.screenshot({ path: dir + '/shots/round-27-saved.png' })
