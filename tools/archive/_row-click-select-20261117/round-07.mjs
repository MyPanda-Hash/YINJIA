// round-07.mjs — 用"元素上真实派发一次 click(冒泡)"验证格内控件/日排产格不会翻勾选
//   为什么要这样:日排产列在横向滚动的最右边,视口里点不到(round-06 找不到可见格子),
//   而 sticky 冻结列会盖住坐标 ⇒ 用坐标点会点到别人的格子。这里把 click 直接派发到格内元素上,
//   走的仍是 el-table 的 row-click 链路,判据(business/rowSelect.js)一样被真正执行。
const SHOT = 'D:/workspace/yinjia/tools/archive/_row-click-select-20261117'
const entry = (await listTaskSpaces()).find((s) => s.name === 'yinjia-rowclick-select-20261117')
const task = entry ? await taskSpace(entry.id) : await taskSpace('yinjia-rowclick-select-20261117')
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page))

const state = () => page.evaluate(() => {
  const table = document.querySelectorAll('.el-table')[0]
  return {
    checkedRows: table ? table.querySelectorAll('.el-table__body .el-checkbox.is-checked').length : -1,
    inlineEditors: document.querySelectorAll('.dp-input').length,
    buttons: [...document.querySelectorAll('.el-button')].filter((b) => /（\d+）/.test(b.textContent || ''))
      .map((b) => (b.textContent || '').trim()).slice(0, 8),
  }
})

/** 在第一个匹配元素上派发一次冒泡 click(等于"人点了这个格子里的这个元素") */
async function tapInside(selector, label) {
  const r = await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    el.click()
    return { tag: el.tagName.toLowerCase(), cls: typeof el.className === 'string' ? el.className : '' }
  }, selector)
  console.log(`[${label}] 派发 click 到:`, JSON.stringify(r))
  await page.waitForTimeout(800)
}

// ───── ① 订单结转:点「本次转单数量」输入框 ─────
await page.goto('http://localhost:5173/#/prod/plan/orderConvert', { timeout: 30000 })
await page.waitForTimeout(2000)
await page.click('text=跳到最近有数据的一天', { label: '跳到最近有数据的一天' }).catch(() => {})
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(1500)
const b1 = await state()
await tapInside('.el-table__body .el-input-number input', '点本次转单数量输入框')
const a1 = await state()
console.log('[订单结转·数量输入框] 前:', JSON.stringify(b1), '后:', JSON.stringify(a1), '⇒ 未翻勾选:', a1.checkedRows === b1.checkedRows)
await page.screenshot({ path: `${SHOT}/订单结转-数量框不翻勾选.png` })

// ───── ② 生产工单:点日排产格 ─────
await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 30000 })
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(2000)
const b2 = await state()
await tapInside('.el-table__body .dp-plan', '点日排产格')
const a2 = await state()
console.log('[生产工单·日排产格] 前:', JSON.stringify(b2), '后:', JSON.stringify(a2),
  '⇒ 未翻勾选:', a2.checkedRows === b2.checkedRows, '| 就地编辑出现:', a2.inlineEditors > 0)
await page.screenshot({ path: `${SHOT}/生产工单-日排产格不翻勾选.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// ───── ③ 生产工单:点工单号链接 ─────
const b3 = await state()
await tapInside('.el-table__body .el-link', '点工单号链接')
await page.waitForTimeout(800)
const a3 = await state()
console.log('[生产工单·工单号链接] 前:', JSON.stringify(b3), '后:', JSON.stringify(a3), '⇒ 未翻勾选:', a3.checkedRows === b3.checkedRows)
await page.screenshot({ path: `${SHOT}/生产工单-工单号链接不翻勾选.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// ───── ④ 工单排产:点日排产格 ─────
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 30000 })
await page.waitForTimeout(2500)
const line = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.wb-left .wb-line')].find((e) => !e.classList.contains('off'))
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
})
if (line) await page.mouse.click(line.x, line.y, { label: '点选一条生产线' })
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(2500)
const b4 = await state()
await tapInside('.el-table__body .dp-plan', '点日排产格')
const a4 = await state()
console.log('[工单排产·日排产格] 前:', JSON.stringify(b4), '后:', JSON.stringify(a4),
  '⇒ 未翻勾选:', a4.checkedRows === b4.checkedRows, '| 就地编辑出现:', a4.inlineEditors > 0)
await page.screenshot({ path: `${SHOT}/工单排产-日排产格不翻勾选.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
