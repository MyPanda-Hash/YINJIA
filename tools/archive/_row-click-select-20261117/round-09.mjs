// round-09.mjs — 会话过期后重新登录(YJ_TEST),再补验:格内控件/链接/日排产格不翻勾选 + 普通格子能翻
const SHOT = 'D:/workspace/yinjia/tools/archive/_row-click-select-20261117'
const entry = (await listTaskSpaces()).find((s) => s.name === 'yinjia-rowclick-select-20261117')
const task = entry ? await taskSpace(entry.id) : await taskSpace('yinjia-rowclick-select-20261117')
const page = (await task.pages())[0]

// ───── 登录 ─────
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.waitForTimeout(1500)
const logged = await page.evaluate(() => {
  const setVal = (el, v) => {
    if (!el) return false
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }
  const ins = [...document.querySelectorAll('input')]
  const a = setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
  const b = setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  const btn = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
  if (btn) btn.click()
  return { account: a, password: b, clicked: !!btn }
})
console.log('登录动作:', JSON.stringify(logged))
await page.waitForTimeout(4500)
console.log('登录后 hash:', await page.url())

const state = () => page.evaluate(() => {
  const table = document.querySelectorAll('.el-table')[0]
  return {
    checkedRows: table ? table.querySelectorAll('.el-table__body .el-checkbox.is-checked').length : -1,
    inlineEditors: document.querySelectorAll('.dp-input').length,
    rows: table ? table.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length : -1,
    buttons: [...document.querySelectorAll('.el-button')].filter((b) => /（\d+）/.test(b.textContent || ''))
      .map((b) => (b.textContent || '').trim()).slice(0, 6),
  }
})

async function tapInside(selector, label) {
  const r = await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    el.click()
    return { tag: el.tagName.toLowerCase(), cls: typeof el.className === 'string' ? el.className.slice(0, 40) : '' }
  }, selector)
  console.log(`[${label}] click 派发到:`, JSON.stringify(r))
  await page.waitForTimeout(900)
}

async function clickCell(x, y, label) {
  await page.mouse.click(x, y, { label })
  await page.waitForTimeout(600)
}

/** 取一个"普通数据格"的坐标(排除控件/链接/日排产格) */
const cellXY = (i) => page.evaluate((idx) => {
  const table = document.querySelectorAll('.el-table')[idx]
  const row = table?.querySelector('.el-table__body > tbody > tr.el-table__row')
  if (!row) return null
  row.scrollIntoView({ block: 'center' })
  for (const td of [...row.querySelectorAll('td')]) {
    if (td.querySelector('input, a, button, .el-link, .el-checkbox, .dp-plan, .el-input-number, .el-date-editor, .el-select')) continue
    const text = (td.textContent || '').trim()
    if (!text) continue
    const r = td.getBoundingClientRect()
    if (r.width < 24 || r.height < 12 || r.top < 20 || r.bottom > window.innerHeight) continue
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), text: text.slice(0, 18) }
  }
  return null
}, i)

// ───── ① 生产工单:普通格能翻 + 日排产格/链接不翻 ─────
await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 30000 })
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 25000 }).catch(() => {})
await page.waitForTimeout(2500)
const c = await cellXY(0)
console.log('[生产工单] 普通格:', JSON.stringify(c))
const s0 = await state()
if (c) await clickCell(c.x, c.y, '点普通数据格')
const s1 = await state()
console.log('[生产工单·普通格] 前:', JSON.stringify(s0), '→ 后:', JSON.stringify(s1), '⇒ 翻上了:', s1.checkedRows === s0.checkedRows + 1)
await page.screenshot({ path: `${SHOT}/生产工单-勾选.png` })
if (c) await clickCell(c.x, c.y, '再点取消')
console.log('[生产工单·再点] 取消:', JSON.stringify(await state()))

const b2 = await state()
await tapInside('.el-table__body .dp-plan', '点日排产格')
const a2 = await state()
console.log('[生产工单·日排产格] 前:', JSON.stringify(b2), '后:', JSON.stringify(a2),
  '⇒ 未翻勾选:', a2.checkedRows === b2.checkedRows, '| 就地编辑出现:', a2.inlineEditors > 0)
await page.screenshot({ path: `${SHOT}/生产工单-日排产格不翻勾选.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

const b3 = await state()
await tapInside('.el-table__body .el-link', '点工单号链接')
const a3 = await state()
console.log('[生产工单·工单号链接] 前:', JSON.stringify(b3), '后:', JSON.stringify(a3), '⇒ 未翻勾选:', a3.checkedRows === b3.checkedRows)
await page.screenshot({ path: `${SHOT}/生产工单-工单号链接不翻勾选.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

// ───── ② 工单排产:日排产格不翻 ─────
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

// ───── ③ 订单结转:数量输入框不翻 ─────
await page.goto('http://localhost:5173/#/prod/plan/orderConvert', { timeout: 30000 })
await page.waitForTimeout(2000)
await page.click('text=跳到最近有数据的一天', { label: '跳到最近有数据的一天' }).catch(() => {})
await page.waitForFunction(() => document.querySelectorAll('.el-table__body > tbody > tr.el-table__row').length > 0, undefined, { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(1500)
const b5 = await state()
await tapInside('.el-table__body .el-input-number input', '点本次转单数量输入框')
const a5 = await state()
console.log('[订单结转·数量输入框] 前:', JSON.stringify(b5), '后:', JSON.stringify(a5), '⇒ 未翻勾选:', a5.checkedRows === b5.checkedRows)
await page.screenshot({ path: `${SHOT}/订单结转-数量框不翻勾选.png` })
