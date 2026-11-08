// 生产工序进度看板 — Lead 终验 Round 1(2026-11-08)
// 目标:看板视图/列表视图渲染、浅色系统风、行点击跳生产工单并定位+自动开追溯、切页后弹窗不残留
const OUT = 'C:/Users/vigna/ego/wo-progress-board-lead-final-20261108'

const task = await taskSpace('wo-progress-board-lead-final-20261108')
const page = task.page('p1')
console.log({ spaceId: task.spaceId, page: page.label })

async function restoreWindow(p) {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await p.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

async function shot(name) {
  await restoreWindow(page)
  const p = await page.screenshot({ path: OUT + '/' + name })
  console.log('shot:', p)
  return p
}

async function autoLogin() {
  await page.evaluate(() => {
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
  })
  await page.waitForTimeout(4000)
}

// 1) 进入看板页(未登录先登录)
await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 })
await page.waitForTimeout(4000)
let hash = await page.evaluate(() => location.hash)
if (String(hash).includes('/login')) {
  console.log('need login, auto login...')
  await autoLogin()
  await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 })
  await page.waitForTimeout(4000)
}

// 2) 看板视图检查 + 截图
await shot('round-01-board.png')
const board = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  const rings = [...document.querySelectorAll('.wpb-grid-row svg')].filter((s) => s.querySelector('circle'))
  const bg = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).backgroundColor : null }
  return {
    hash: location.hash,
    title: document.title,
    pageTitle: txt(document.querySelector('.wpb-title')),
    clock: txt(document.querySelector('.wpb-clock')),
    dataTime: txt(document.querySelector('.wpb-datatime')),
    stats: [...document.querySelectorAll('.wpb-stat')].map(txt).slice(0, 6),
    rowCount: rows.length,
    ringCount: rings.length,
    firstRow: rows.length ? txt(rows[0]).slice(0, 300) : '',
    hasMenuEntry: document.body.innerText.includes('生产工序进度看板'),
    pageBg: bg('.wpb-page'),
    screenBg: bg('.wpb-screen'),
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    viewport: [window.innerWidth, window.innerHeight],
  }
})
console.log('BOARD:', JSON.stringify(board, null, 2))

// 3) 切到列表视图
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-radio-button__inner')].find((x) => (x.textContent || '').includes('列表'))
  if (b) b.click()
})
await page.waitForTimeout(1500)
await shot('round-01-list.png')
const list = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.wpb-table .el-table__body tr')]
  const chains = [...document.querySelectorAll('.wpc')]
  return {
    tableRowCount: rows.length,
    chainCount: chains.length,
    firstRow: rows.length ? txt(rows[0]).slice(0, 320) : '',
    header: [...document.querySelectorAll('.wpb-table th')].map(txt).slice(0, 10),
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  }
})
console.log('LIST:', JSON.stringify(list, null, 2))

// 4) 切回看板 → 点第一行 → 应跳生产工单并定位 + 自动打开追溯
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-radio-button__inner')].find((x) => (x.textContent || '').includes('看板'))
  if (b) b.click()
})
await page.waitForTimeout(1200)
const firstWo = await page.evaluate(() => {
  const row = document.querySelector('.wpb-grid-row')
  if (!row) return null
  const no = row.querySelector('.wpb-no')
  return { text: (row.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200), wo: no ? no.textContent.trim() : '' }
})
console.log('FIRST_WO:', JSON.stringify(firstWo))
await page.click('.wpb-grid-row >> nth=0', { label: '点击工单行跳转' })
await page.waitForTimeout(3500)
await shot('round-01-jump-trace.png')
const jump = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dialog = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('工单详情'))
  const cur = document.querySelector('.wpb-table, .el-table')
  const curRow = document.querySelector('.el-table__body tr.current-row')
  const title = txt(document.querySelector('.el-dialog__title'))
  const overlayVisible = [...document.querySelectorAll('.el-overlay')].some((o) => getComputedStyle(o).display !== 'none')
  return {
    hash: location.hash,
    dialogVisible: !!dialog,
    dialogTitle: title,
    overlayVisible,
    currentRowHighlighted: !!curRow,
    currentRowText: curRow ? txt(curRow).slice(0, 200) : '',
    keywordInput: document.querySelector('input[placeholder]') ? [...document.querySelectorAll('input')].map((i) => i.value).filter((v) => v && v.startsWith('GD-')) : [],
    tableExists: !!cur,
  }
})
console.log('JUMP:', JSON.stringify(jump, null, 2))

// 5) 切到别的页签 → 追溯弹窗应随 WorkOrderList onDeactivated 关闭,不挡新页面点击
await page.evaluate(() => { location.hash = '#/prod/plan/workOrderBoard' })
await page.waitForTimeout(3000)
const afterLeave = await page.evaluate(() => {
  const visibleOverlays = [...document.querySelectorAll('.el-overlay')].filter((o) => {
    const cs = getComputedStyle(o)
    return cs.display !== 'none' && cs.visibility !== 'hidden'
  })
  return {
    hash: location.hash,
    visibleOverlayCount: visibleOverlays.length,
    dialogTitles: [...document.querySelectorAll('.el-dialog__title')].map((t) => (t.textContent || '').trim()),
    pageText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200),
  }
})
console.log('AFTER_LEAVE:', JSON.stringify(afterLeave, null, 2))
await shot('round-01-after-leave.png')

console.log('ROUND1_DONE')
