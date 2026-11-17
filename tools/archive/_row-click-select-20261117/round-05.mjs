// round-05.mjs — 用语义选择器重验「日排产格点了不翻勾选」(round-04 用坐标打偏了,先打点取证)
//   ① 生产工单:点第一个 .dp-plan
//   ② 工单排产:点第一个 .dp-plan
// 判据:勾选行数不变 + 就地编辑框出现(.dp-input)
const SHOT = 'D:/workspace/yinjia/tools/archive/_row-click-select-20261117'
const entry = (await listTaskSpaces()).find((s) => s.name === 'yinjia-rowclick-select-20261117')
const task = entry ? await taskSpace(entry.id) : await taskSpace('yinjia-rowclick-select-20261117')
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))

const state = () => page.evaluate(() => {
  const table = document.querySelectorAll('.el-table')[0]
  return {
    checkedRows: table ? table.querySelectorAll('.el-table__body .el-checkbox.is-checked').length : -1,
    inlineEditors: document.querySelectorAll('.dp-input').length,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }
})

async function tapCell(selector, label) {
  // 打点:先看这个坐标上到底是谁(验证不是"点偏")
  const box = await page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().width > 0)
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    const x = Math.round(r.left + r.width / 2)
    const y = Math.round(r.top + r.height / 2)
    const at = document.elementFromPoint(x, y)
    const path = (n) => { const out = []; let p = n; while (p && out.length < 4) { out.push(p.tagName.toLowerCase() + (p.className && typeof p.className === 'string' ? '.' + p.className.trim().split(/\s+/).join('.') : '')); p = p.parentElement } return out }
    return { x, y, text: (el.textContent || '').trim().slice(0, 20), hit: path(at) }
  }, selector)
  if (!box) { console.log(`[${label}] ✗ 没找到 ${selector}`); return null }
  console.log(`[${label}] 打点:`, JSON.stringify(box))
  await page.mouse.click(box.x, box.y, { label })
  return box
}

// ───── ① 生产工单 ─────
await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 30000 })
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(2000)
const b1 = await state()
await tapCell('.el-table__body .dp-plan', '点日排产格')
await page.waitForTimeout(800)
const a1 = await state()
console.log('[生产工单·日排产格] 前:', JSON.stringify(b1), '后:', JSON.stringify(a1), '⇒ 未翻勾选:', a1.checkedRows === b1.checkedRows)
await page.screenshot({ path: `${SHOT}/生产工单-日排产格不翻勾选.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

// ───── ② 工单排产 ─────
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(2500)
const line = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-left .wb-line')].find((e) => !e.classList.contains('off'))
  if (!el) return null
  el.scrollIntoView({ block: 'center' })
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
})
if (line) await page.mouse.click(line.x, line.y, { label: '点选一条生产线' })
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(2500)
const b2 = await state()
await tapCell('.el-table__body .dp-plan', '点日排产格')
await page.waitForTimeout(800)
const a2 = await state()
console.log('[工单排产·日排产格] 前:', JSON.stringify(b2), '后:', JSON.stringify(a2), '⇒ 未翻勾选:', a2.checkedRows === b2.checkedRows)
await page.screenshot({ path: `${SHOT}/工单排产-日排产格不翻勾选.png` })
