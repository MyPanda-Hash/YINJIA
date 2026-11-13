// round-01.mjs — 验收第 1 轮:打开生产工单页,确认登录/页面状态,核对日期范围控件形态 + 快捷档(清单 1)
// 只读:只点开日期控件、不点任何业务写操作(结案/切单/打印/排产/保存/删除一律不碰)
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-daterange-verify-20261109'
await fs.mkdir(OUT, { recursive: true })

const URL = 'http://localhost:5173/#/prod/plan/workOrderList'
const task = await taskSpace('wo-daterange-verify-20261109')
const page = task.page('p1')
console.log('spaceId=' + task.spaceId + ' page=' + page.label)

await page.goto(URL, { timeout: 40000 })
await page.waitForTimeout(4000)

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(600)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

function loginScript() {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const u = ins.find((i) => (i.placeholder || '').includes('账号'))
  const p = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (u) setVal(u, 'admin')
  if (p) setVal(p, '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
}

// ── 登录态检查 ──
const loginInfo = await page.evaluate(() => ({
  hash: location.hash,
  loginInputs: [...document.querySelectorAll('input')].map((i) => i.placeholder || '').filter(Boolean).slice(0, 8),
  hasEnterBtn: [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('进入系统')),
  hasWolPage: !!document.querySelector('.wol-page'),
}))
console.log('login check: ' + JSON.stringify(loginInfo))
if (loginInfo.hasEnterBtn) {
  await page.evaluate(loginScript)
  await page.waitForTimeout(5000)
  await page.goto(URL, { timeout: 40000 })
  await page.waitForTimeout(5000)
  console.log('auto-login done; hash=' + (await page.evaluate(() => location.hash)))
}

// ── 页面基础事实:查询区控件形态 / 分页 / 计数 / 表行 ──
const facts = await page.evaluate(() => {
  const q = document.querySelector('.wol-query')
  const qInputs = q ? [...q.querySelectorAll('input')].map((i) => ({ ph: i.placeholder || '', val: i.value, cls: i.className, readonly: i.readOnly })) : []
  const drq = document.querySelector('.wol-query .drq-picker')
  const drqRoot = drq ? (drq.closest('.el-date-editor') || drq) : null
  const pager = document.querySelector('.wol-pager')
  const pag = pager ? pager.querySelector('.el-pagination') : null
  const table = document.querySelector('.wol-table')
  const rows = table ? table.querySelectorAll('.el-table__body-wrapper tbody tr').length : -1
  const ths = table ? [...table.querySelectorAll('.el-table__header th')].length : -1
  const countEl = document.querySelector('.wol-count')
  const radios = [...document.querySelectorAll('.wol-line .el-radio-button')].map((r) => (r.innerText || '').trim())
  const activePage = pag ? (pag.querySelector('.el-pager li.is-active') || {}).innerText : null
  const pageSizeTxt = pag ? (pag.querySelector('.el-pagination__sizes .el-select__selected-item, .el-pagination__sizes .el-select__placeholder, .el-pagination__sizes input') || {}).value : null
  return {
    hash: location.hash,
    hasWolPage: !!document.querySelector('.wol-page'),
    queryText: q ? (q.innerText || '').replace(/\s+/g, ' ').trim() : null,
    qInputs,
    hasDrqPicker: !!drq,
    drqEditor: drqRoot ? { cls: drqRoot.className, w: Math.round(drqRoot.getBoundingClientRect().width) } : null,
    countText: countEl ? (countEl.innerText || '').replace(/\s+/g, ' ').trim() : null,
    tableRows: rows,
    tableThs: ths,
    pagerExists: !!pager,
    pagerText: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
    pagerTotal: pag ? (pag.querySelector('.el-pagination__total') || {}).innerText : null,
    activePage,
    pageSizeInput: pageSizeTxt,
    radios,
  }
})
console.log('PAGE FACTS: ' + JSON.stringify(facts, null, 2))

// ── 清单 1:点开日期控件,抓快捷档文本 + 截图 ──
await restoreWindow()
const q = '.wol-query .drq-picker'
await page.click(q)
await page.waitForTimeout(1200)
const panel = await page.evaluate(() => {
  const panels = [...document.querySelectorAll('.el-picker-panel')].filter((p) => p.offsetParent !== null)
  const p = panels[panels.length - 1]
  return {
    panelVisible: !!p,
    panelCls: p ? p.className : null,
    shortcuts: p ? [...p.querySelectorAll('.el-picker-panel__shortcut')].map((b) => (b.textContent || '').trim()) : [],
    headers: p ? [...p.querySelectorAll('.el-date-range-picker__header')].map((h) => (h.innerText || '').replace(/\s+/g, ' ').trim()) : [],
    startPh: [...document.querySelectorAll('.wol-query input')].map((i) => i.placeholder),
  }
})
console.log('PICKER PANEL: ' + JSON.stringify(panel, null, 2))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-01-picker-open.png' })
console.log('screenshot -> ' + OUT + '/round-01-picker-open.png')

// 关掉面板(ESC),不改值
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
await restoreWindow()
await page.screenshot({ path: OUT + '/round-01-default.png' })
console.log('screenshot -> ' + OUT + '/round-01-default.png')

// 页面组件内部状态(5173 dev 构建可用):确认控件就是 DateRangeQuery 组件
const comp = await page.evaluate(() => {
  const rootEl = document.querySelector('.drq-picker') || document.querySelector('.wol-page')
  let node = rootEl
  const chain = []
  for (let i = 0; i < 12 && node; i++, node = node.parentElement) {
    const c = node.__vueParentComponent
    if (c) chain.push({ tag: node.className && String(node.className).slice(0, 60), name: c.type && (c.type.__name || c.type.name) })
  }
  const wol = document.querySelector('.wol-page')
  const wolC = wol && wol.__vueParentComponent
  const ss = wolC && wolC.setupState
  return {
    chain,
    wolSetupKeys: ss ? Object.keys(ss).filter((k) => /date|page|filter|query|rows/i.test(k)) : null,
    datePick: ss && ss.datePick ? JSON.parse(JSON.stringify(ss.datePick)) : null,
    pageNo: ss ? ss.pageNo : null,
    pageSize: ss ? ss.pageSize : null,
    rowsLen: ss && ss.rows ? ss.rows.length : null,
    filteredLen: ss && ss.filtered ? ss.filtered.length : null,
  }
})
console.log('COMPONENT STATE: ' + JSON.stringify(comp, null, 2))
console.log('DONE round-01')
