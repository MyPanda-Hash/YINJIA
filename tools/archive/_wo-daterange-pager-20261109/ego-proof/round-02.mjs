// round-02.mjs — 验收第 2 轮:快捷档「近 30 天」实测(清单 2) + 控件宽度取证 + 大日期范围填值机制预演
// 只读:仅查询/翻页/筛选,不点任何写操作
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-daterange-verify-20261109'
await fs.mkdir(OUT, { recursive: true })

const task = await taskSpace('wo-daterange-verify-20261109')
const page = task.page('p1')
console.log('resumed spaceId=' + task.spaceId + ' page=' + page.label)

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(600)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

// 确认还在生产工单页
let hash = await page.evaluate(() => location.hash)
console.log('current hash=' + hash)
if (!hash.includes('/prod/plan/workOrderList')) {
  await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 40000 })
  await page.waitForTimeout(5000)
}

const state = () => page.evaluate(() => {
  const q = document.querySelector('.wol-query')
  const table = document.querySelector('.wol-table')
  const rows = table ? [...table.querySelectorAll('.el-table__body-wrapper tbody tr')] : []
  const pag = document.querySelector('.wol-pager .el-pagination')
  return {
    hash: location.hash,
    inputs: q ? [...q.querySelectorAll('input')].map((i) => i.value) : [],
    countText: (document.querySelector('.wol-count') || {}).innerText,
    rows: rows.length,
    ths: table ? table.querySelectorAll('.el-table__header th').length : -1,
    pager: pag ? (pag.innerText || '').replace(/\s+/g, ' ').trim() : null,
    activePage: pag ? ((pag.querySelector('.el-pager li.is-active') || {}).innerText) : null,
    firstRowText: rows[0] ? (rows[0].innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120) : null,
  }
})

const before = await state()
console.log('BEFORE: ' + JSON.stringify(before))

// ── 清单 2:点开日期控件 → 点快捷档「近 30 天」 ──
await page.click('.wol-query .drq-picker')
await page.waitForTimeout(1000)
const panelsBefore = await page.evaluate(() => [...document.querySelectorAll('.el-picker-panel')].filter((p) => p.offsetParent !== null).length)
console.log('panels visible before shortcut=' + panelsBefore)

const t0 = Date.now()
await page.click('text=近 30 天')
await page.waitForTimeout(300)
const panelsAfter = await page.evaluate(() => [...document.querySelectorAll('.el-picker-panel')].filter((p) => p.offsetParent !== null).length)
// 等计数/行数变化并稳定
let last = ''
let stable = 0
const deadline = Date.now() + 20000
let after = null
while (Date.now() < deadline) {
  await page.waitForTimeout(250)
  const s = await state()
  const sig = JSON.stringify([s.countText, s.rows, s.inputs])
  if (sig === last) stable += 1; else { stable = 0; last = sig }
  after = s
  if (stable >= 3) break
}
const elapsed = Date.now() - t0
console.log('SHORTCUT after: ' + JSON.stringify(after))
console.log(JSON.stringify({ shortcut: '近 30 天', panelsBefore, panelsAfter, changeTriggered: before.countText !== after.countText || JSON.stringify(before.inputs) !== JSON.stringify(after.inputs), elapsedMs: elapsed }))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-02-shortcut-30d.png' })
console.log('screenshot -> ' + OUT + '/round-02-shortcut-30d.png')

// ── 控件宽度/样式取证(组件默认 250px 是否生效) ──
const styleInfo = await page.evaluate(() => {
  const el = document.querySelector('.wol-query .drq-picker')
  if (!el) return null
  const cs = getComputedStyle(el)
  const rules = []
  for (const sheet of document.styleSheets) {
    let list
    try { list = sheet.cssRules } catch (e) { continue }
    for (const r of list || []) {
      if (r.selectorText && r.selectorText.includes('drq-picker')) rules.push({ sel: r.selectorText, w: r.style.width })
    }
  }
  return {
    cls: el.className,
    attrs: el.getAttributeNames().filter((a) => a.startsWith('data-v')),
    rect: Math.round(el.getBoundingClientRect().width),
    computedWidth: cs.width,
    inlineStyleWidth: el.style.width || null,
    matchedRules: rules,
    ancestorWidths: (() => {
      const out = []
      let n = el.parentElement
      for (let i = 0; i < 4 && n; i++, n = n.parentElement) out.push({ tag: n.className && String(n.className).slice(0, 50), w: Math.round(n.getBoundingClientRect().width) })
      return out
    })(),
  }
})
console.log('STYLE INFO: ' + JSON.stringify(styleInfo, null, 2))

// ── 预演:往 daterange 两个输入框填 2020-01-01 / 2030-12-31(先不点查找,观察是否自动查) ──
await page.click('.wol-query .drq-picker')
await page.waitForTimeout(800)
const inputsNow = await page.evaluate(() => [...document.querySelectorAll('.wol-query .el-range-input')].map((i) => i.value))
console.log('range inputs before fill=' + JSON.stringify(inputsNow))

let fillOk = false
try {
  const startSel = '.wol-query .el-range-input >> nth=0'
  const endSel = '.wol-query .el-range-input >> nth=1'
  await page.fill(startSel, '')
  await page.fill(startSel, '2020-01-01')
  await page.fill(endSel, '')
  await page.fill(endSel, '2030-12-31')
  await page.press(endSel, 'Enter')
  await page.waitForTimeout(4000)
  fillOk = true
} catch (e) { console.log('fill failed: ' + e.message) }

const afterFill = await state()
console.log('AFTER FILL: ' + JSON.stringify(afterFill))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-02-wide-range.png' })
console.log('screenshot -> ' + OUT + '/round-02-wide-range.png')

// 页面组件内部状态对账(dev 构建)
const comp = await page.evaluate(() => {
  const wol = document.querySelector('.wol-page')
  const ss = wol && wol.__vueParentComponent && wol.__vueParentComponent.setupState
  return ss ? { datePick: JSON.parse(JSON.stringify(ss.datePick || null)), queryRange: JSON.parse(JSON.stringify(ss.queryRange || null)), pageNo: ss.pageNo, pageSize: ss.pageSize, rowsLen: ss.rows.length, filteredLen: ss.filtered.length, pagedLen: ss.paged.length } : null
})
console.log('COMPONENT STATE: ' + JSON.stringify(comp))
console.log('DONE round-02')
