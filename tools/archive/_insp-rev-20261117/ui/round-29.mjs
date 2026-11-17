// round-29: 用真实键盘输入填必填(坐标点击 + keyboard.type),再保存
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

const boxes = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const rows = [...sheet.querySelectorAll('tbody > tr')]
  const tr = rows.find((r) => /样品名称/.test(r.textContent || ''))
  const ins = [...tr.querySelectorAll('input')]
  const rect = (el) => {
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  }
  return { name: ins[0] ? rect(ins[0]) : null, qty: ins[2] ? rect(ins[2]) : null }
})
console.log('boxes=' + JSON.stringify(boxes))

if (boxes.name) {
  await page.mouse.click(boxes.name.x, boxes.name.y, { label: '样品名称' })
  await T(300)
  await page.keyboard.type('净水器滤芯', { delay: 30 })
  await T(400)
}
if (boxes.qty) {
  await page.mouse.click(boxes.qty.x, boxes.qty.y, { label: '样品数量' })
  await T(300)
  await page.keyboard.type('3支', { delay: 30 })
  await T(400)
}

const mid = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /样品名称/.test(r.textContent || ''))
  return { texts: [...tr.querySelectorAll('input')].map((i) => i.value) }
})
console.log('typed=' + JSON.stringify(mid))

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
  }
})
console.log(JSON.stringify(res, null, 2))
await page.screenshot({ path: dir + '/shots/round-29-saved.png' })
