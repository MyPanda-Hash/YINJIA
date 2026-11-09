// Round 07:主要属性扩充终验(2026-11-08,Lead)——看板 6 列 / 列表新列 / 无溢出 / 点行跳转
const OUT = 'C:/Users/vigna/ego/wo-progress-board-attrs-lead-20261108'
const task = await taskSpace('wo-progress-board-attrs-lead-20261108')
const page = task.page('p1')

async function restoreWindow(p) {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await p.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
async function shot(name) {
  await restoreWindow(page)
  console.log('shot:', await page.screenshot({ path: OUT + '/' + name }))
}
async function autoLogin() {
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4500)
}

// ---------- ① 5173 看板视图(1392 CSS) ----------
await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 })
await page.waitForTimeout(4000)
let hash = await page.evaluate(() => location.hash)
if (String(hash).includes('/login')) { await autoLogin(); await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 }); await page.waitForTimeout(4000) }
await page.evaluate(() => { localStorage.setItem('mes_locale', 'zh-CN') })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4000)
await shot('round-07-board-1392.png')

const board = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  const headers = [...document.querySelectorAll('.wpb-grid-head > span')].map(txt)
  const first = rows[0]
  const labels = first ? [...first.querySelectorAll('.wpb-kv')].map(txt) : []
  return {
    hash: location.hash,
    headers,
    headCols: (() => { const g = document.querySelector('.wpb-grid'); return g ? getComputedStyle(g).gridTemplateColumns : null })(),
    rows: rows.length,
    rings: [...document.querySelectorAll('.wpb-grid-row svg')].filter((s) => s.querySelector('circle')).length,
    firstRowText: txt(first).slice(0, 500),
    kvLabels: labels,
    hasProductCodeLabel: document.body.innerText.includes('产品编码'),
    hasSpecLabel: document.body.innerText.includes('规格型号'),
    hasDemand: document.body.innerText.includes('需求数量'),
    hasReceived: document.body.innerText.includes('入库数量'),
    hasBalance: document.body.innerText.includes('余量'),
    hasDue: document.body.innerText.includes('计划完工日期'),
    hasOrderNo: document.body.innerText.includes('订单号'),
    hasCurOp: document.body.innerText.includes('当前工序'),
    docScroll: { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth },
    boardBodyScroll: (() => { const b = document.querySelector('.wpb-grid-body'); return b ? { client: b.clientWidth, scroll: b.scrollWidth } : null })(),
  }
})
console.log('BOARD1392:', JSON.stringify(board, null, 2))

// ---------- ② 列表视图:新增列 ----------
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-radio-button__inner')].find((x) => (x.textContent || '').includes('列表'))
  if (b) b.click()
})
await page.waitForTimeout(1600)
const list = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const ths = [...document.querySelectorAll('.wpb-table th')].map(txt)
  const rows = [...document.querySelectorAll('.wpb-table .el-table__body tr')]
  return {
    headers: ths,
    headerCount: ths.length,
    rows: rows.length,
    firstRow: rows.length ? txt(rows[0]).slice(0, 400) : '',
    tableScrollWidth: (() => { const t = document.querySelector('.wpb-table'); return t ? { client: t.clientWidth, scroll: t.scrollWidth } : null })(),
  }
})
console.log('LIST:', JSON.stringify(list, null, 2))
await shot('round-07-list.png')

// ---------- ③ 1920 CSS 宽(CDP 模拟) ----------
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await page.waitForTimeout(2000)
// 切回看板
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-radio-button__inner')].find((x) => (x.textContent || '').includes('看板'))
  if (b) b.click()
})
await page.waitForTimeout(1500)
const wide = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  return {
    viewport: [window.innerWidth, window.innerHeight],
    headCols: (() => { const g = document.querySelector('.wpb-grid'); return g ? getComputedStyle(g).gridTemplateColumns : null })(),
    rows: rows.length,
    maxStepsPerRow: Math.max(...rows.map((r) => r.querySelectorAll('.wpr').length)),
    docScroll: { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth },
  }
})
console.log('WIDE:', JSON.stringify(wide, null, 2))
await shot('round-07-board-1920.png')
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await page.waitForTimeout(800)

// ---------- ④ 点行跳转仍正常(属性扩充没破坏交互) ----------
await page.click('.wpb-grid-row >> nth=0', { label: '点击工单行跳转' })
await page.waitForTimeout(3500)
const jump = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dialog = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('工单详情'))
  return {
    hash: location.hash,
    dialogVisible: !!dialog,
    dialogTitle: txt(document.querySelector('.el-dialog__title')),
    currentRowHighlighted: !!document.querySelector('.el-table__body tr.current-row'),
    keyword: [...document.querySelectorAll('input')].map((i) => i.value).filter((v) => v && v.startsWith('GD-')),
  }
})
console.log('JUMP:', JSON.stringify(jump, null, 2))
await shot('round-07-jump.png')
console.log('ROUND7_DONE')
