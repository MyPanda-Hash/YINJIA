// round-11:诊断数量输入框 → 用原生 setter 填 1234(v-model 生效) → 打印并读纸面
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.waitForTimeout(300)

const before = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  const ins = [...root.querySelectorAll('.el-input-number input')]
  return {
    open: !!root,
    checked: root.querySelectorAll('.el-table__body .el-checkbox.is-checked').length,
    inputs: ins.map((i) => {
      const b = i.getBoundingClientRect()
      return { v: i.value, w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top), disabled: i.disabled }
    }),
    viewport: { w: innerWidth, h: innerHeight, scrollY: scrollY },
    foot: txt(root.querySelector('.pup-foot')),
  }
})
console.log('before=' + JSON.stringify(before, null, 2))

const filled = await page.evaluate(() => {
  const root = document.querySelector('.pup')
  const inp = root.querySelectorAll('.el-input-number input')[0]
  if (!inp) return 'no input'
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '1234')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.blur()
  return 'filled'
})
console.log(filled)
await page.waitForTimeout(700)

const edited = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  const rows = [...root.querySelectorAll('.el-table__body tbody tr')]
  return {
    checked: root.querySelectorAll('.el-table__body .el-checkbox.is-checked').length,
    row1: txt(rows[0]),
    row2: txt(rows[1]),
    qtyInputs: [...root.querySelectorAll('.el-input-number input')].map((i) => i.value),
    foot: txt(root.querySelector('.pup-foot')),
  }
})
console.log('edited=' + JSON.stringify(edited, null, 2))

try {
  const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false })
  const fs = await import('node:fs/promises')
  const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-11-edited.png'
  await fs.writeFile(p, Buffer.from(res.data, 'base64'))
  console.log('screenshot ok=' + p)
} catch (e) { console.log('screenshot fail: ' + e.message) }

// 打桩 window.print(本轮之前没打桩;防止真弹打印对话框)
await page.evaluate(() => {
  window.__printCalls = 0
  if (!window.__origPrint) window.__origPrint = window.print
  window.print = () => { window.__printCalls += 1 }
})
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('确定并打印'))
  if (!btn) return 'no confirm button'
  btn.click()
  return 'clicked confirm'
})
console.log(clicked)
await page.waitForTimeout(2500)

const paper = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const host = document.getElementById('yj-print-host')
  if (!host) return { present: false, printCalls: window.__printCalls, dialogOpen: !!document.querySelector('.pup') }
  const rows = [...host.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => txt(td)))
  return {
    present: true,
    printCalls: window.__printCalls,
    dialogOpen: !!document.querySelector('.pup'),
    title: txt(host.querySelector('h1')),
    header: txt(host.querySelector('.info')),
    tableHeaders: [...host.querySelectorAll('thead th')].map(txt),
    rowCount: rows.length,
    rows,
    hasUncheckedItem: txt(host).includes('YJ-KBL-012'),
    hasQty1234: txt(host).includes('1234'),
    hasAmount95: txt(host).includes('95.3882'),
    hasOldQty5000: txt(host).includes('5000'),
    tail: txt(host).slice(-260),
  }
})
console.log('paper=' + JSON.stringify(paper, null, 2))

await page.evaluate(() => {
  if (window.__origPrint) window.print = window.__origPrint
  document.getElementById('yj-print-host')?.remove()
  document.getElementById('yj-print-host-css')?.remove()
})
