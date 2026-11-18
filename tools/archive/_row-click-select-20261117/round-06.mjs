// round-06.mjs — 正确打点:挑一个"真的在最上层"的 .dp-plan(日排产格),验证点它不翻勾选、且就地编辑出来
//   round-05 的坑:那次命中的 .dp-plan 被右侧冻结列(sticky)盖住 ⇒ elementFromPoint 拿到的是别人的格子,
//   所以"翻勾选"其实是点到了那一格的宿主行。本回合沿列表水平滚动找出可见的 .dp-plan 再点。
const SHOT = 'D:/workspace/yinjia/tools/archive/_row-click-select-20261117'
const entry = (await listTaskSpaces()).find((s) => s.name === 'yinjia-rowclick-select-20261117')
const task = entry ? await taskSpace(entry.id) : await taskSpace('yinjia-rowclick-select-20261117')
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))

const state = () => page.evaluate(() => {
  const table = document.querySelectorAll('.el-table')[0]
  return {
    checkedRows: table ? table.querySelectorAll('.el-table__body .el-checkbox.is-checked').length : -1,
    inlineEditors: document.querySelectorAll('.dp-input').length,
  }
})

/** 找一个"elementFromPoint 就落在它身上"的日排产格;必要时把表格横向滚过去 */
async function findVisibleDp(selector) {
  for (let round = 0; round < 6; round++) {
    const hit = await page.evaluate((sel) => {
      const els = [...document.querySelectorAll(sel)]
      for (const el of els) {
        const r = el.getBoundingClientRect()
        if (r.width < 8 || r.height < 8) continue
        const x = Math.round(r.left + r.width / 2)
        const y = Math.round(r.top + r.height / 2)
        if (x < 60 || y < 60 || y > window.innerHeight - 20) continue
        const at = document.elementFromPoint(x, y)
        const owner = at?.closest(sel)
        if (owner === el) return { x, y, text: (el.textContent || '').trim().slice(0, 20), round }
      }
      return null
    }, selector)
    if (hit) return hit
    // 没找到就横向滚一格(日期列一般在右侧滚动区)
    const moved = await page.evaluate(() => {
      const w = document.querySelector('.el-table__body-wrapper .el-scrollbar__wrap') || document.querySelector('.el-table__body-wrapper')
      if (!w) return false
      const before = w.scrollLeft
      w.scrollLeft = before + 700
      return w.scrollLeft !== before
    })
    if (!moved) return null
    await page.waitForTimeout(400)
  }
  return null
}

// ───── ① 生产工单 ─────
await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 30000 })
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(2000)
const b1 = await state()
const c1 = await findVisibleDp('.dp-plan')
console.log('[生产工单] 命中日排产格:', JSON.stringify(c1))
if (c1) {
  await page.mouse.click(c1.x, c1.y, { label: '点日排产格' })
  await page.waitForTimeout(900)
  const a1 = await state()
  console.log('[生产工单·日排产格] 前:', JSON.stringify(b1), '后:', JSON.stringify(a1),
    '⇒ 未翻勾选:', a1.checkedRows === b1.checkedRows, '| 就地编辑出现:', a1.inlineEditors > 0)
  await page.screenshot({ path: `${SHOT}/生产工单-日排产格不翻勾选.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
}

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
const c2 = await findVisibleDp('.dp-plan')
console.log('[工单排产] 命中日排产格:', JSON.stringify(c2))
if (c2) {
  await page.mouse.click(c2.x, c2.y, { label: '点日排产格' })
  await page.waitForTimeout(900)
  const a2 = await state()
  console.log('[工单排产·日排产格] 前:', JSON.stringify(b2), '后:', JSON.stringify(a2),
    '⇒ 未翻勾选:', a2.checkedRows === b2.checkedRows, '| 就地编辑出现:', a2.inlineEditors > 0)
  await page.screenshot({ path: `${SHOT}/工单排产-日排产格不翻勾选.png` })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}
