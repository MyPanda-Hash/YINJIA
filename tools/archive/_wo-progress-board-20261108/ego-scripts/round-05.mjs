// Round 5:8090 打包版验证(前端在 jar 里)+ 行点击跳转 + 截图(Lead,2026-11-08)
const OUT = 'C:/Users/vigna/ego/wo-progress-board-lead-final-20261108'
const task = await taskSpace('wo-progress-board-lead-final-20261108')
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

await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderProgress', { timeout: 30000 })
await page.waitForTimeout(4000)
let hash = await page.evaluate(() => location.hash)
if (String(hash).includes('/login')) { console.log('login on 8090...'); await autoLogin(); await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderProgress', { timeout: 30000 }); await page.waitForTimeout(4000) }

// 首次访问 8090 可能先弹语言/公告框;关掉可能的遮罩(仅点关闭按钮)
await page.evaluate(() => {
  const closers = [...document.querySelectorAll('.el-dialog__headerbtn, .el-message-box__headerbtn, .el-notification__closeBtn')]
  closers.forEach((b) => b.click())
})
await page.waitForTimeout(800)
await shot('round-05-8090-board.png')

const state = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  return {
    origin: location.origin,
    hash: location.hash,
    title: document.title,
    pageTitle: txt(document.querySelector('.wpb-title')),
    rows: rows.length,
    rings: [...document.querySelectorAll('.wpb-grid-row svg')].filter((s) => s.querySelector('circle')).length,
    stats: [...document.querySelectorAll('.wpb-stat')].map(txt),
    menuEntry: document.body.innerHTML.includes('生产工序进度看板'),
    firstRow: rows.length ? txt(rows[0]).slice(0, 160) : '',
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    dataTime: txt(document.querySelector('.wpb-datatime')),
  }
})
console.log('8090_BOARD:', JSON.stringify(state, null, 2))

// 行点击 → 8090 内跳生产工单并定位
await page.click('.wpb-grid-row >> nth=0', { label: '点击工单行跳转' })
await page.waitForTimeout(3500)
const jump = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dialog = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('工单详情'))
  const curRow = document.querySelector('.el-table__body tr.current-row')
  return {
    origin: location.origin,
    hash: location.hash,
    dialogVisible: !!dialog,
    dialogTitle: txt(document.querySelector('.el-dialog__title')),
    currentRowHighlighted: !!curRow,
    keyword: [...document.querySelectorAll('input')].map((i) => i.value).filter((v) => v && v.startsWith('GD-')),
  }
})
console.log('8090_JUMP:', JSON.stringify(jump, null, 2))
await shot('round-05-8090-jump.png')
console.log('ROUND5_DONE')
