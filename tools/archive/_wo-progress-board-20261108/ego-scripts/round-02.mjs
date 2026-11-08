// Round 2:列表视图宽度诊断 + 列表行点击跳转验证(Lead 终验,2026-11-08)
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

await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 })
await page.waitForTimeout(3500)
// 若被登出,再登录一次
let hash = await page.evaluate(() => location.hash)
if (String(hash).includes('/login')) {
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
  await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 })
  await page.waitForTimeout(3500)
}

// 切列表
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-radio-button__inner')].find((x) => (x.textContent || '').includes('列表'))
  if (b) b.click()
})
await page.waitForTimeout(1500)

const geom = await page.evaluate(() => {
  const el = document.querySelector('.wpb-table')
  const wrap = document.querySelector('.wpb-table-wrap')
  const bodyWrap = document.querySelector('.wpb-table .el-scrollbar__wrap, .wpb-table .el-table__body-wrapper')
  const ths = [...document.querySelectorAll('.wpb-table th')].map((th) => ({ t: (th.textContent || '').trim(), w: Math.round(th.getBoundingClientRect().width) }))
  const firstRowTds = [...document.querySelectorAll('.wpb-table .el-table__body tr:first-child td')].map((td) => ({ t: (td.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40), w: Math.round(td.getBoundingClientRect().width) }))
  const lastPlanCell = firstRowTds[firstRowTds.length - 1]
  return {
    viewport: [window.innerWidth, window.innerHeight],
    table: el ? { clientWidth: el.clientWidth, scrollWidth: el.scrollWidth } : null,
    wrap: wrap ? { clientWidth: wrap.clientWidth, scrollWidth: wrap.scrollWidth } : null,
    bodyWrap: bodyWrap ? { clientWidth: bodyWrap.clientWidth, scrollWidth: bodyWrap.scrollWidth } : null,
    ths,
    firstRowTds,
    planCell: lastPlanCell,
    docScroll: { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth },
  }
})
console.log('GEOM:', JSON.stringify(geom, null, 2))

// 列表视图点第 2 行 → 跳生产工单 + 定位 + 追溯
const second = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.wpb-table .el-table__body tr')]
  const row = rows[1]
  return row ? (row.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160) : null
})
console.log('LIST_SECOND_ROW:', second)
await page.click('.wpb-table .el-table__body tr >> nth=1', { label: '点击列表第二行' })
await page.waitForTimeout(3500)
const after = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const dialog = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('工单详情'))
  const curRow = document.querySelector('.el-table__body tr.current-row')
  return {
    hash: location.hash,
    dialogVisible: !!dialog,
    dialogTitle: txt(document.querySelector('.el-dialog__title')),
    currentRowHighlighted: !!curRow,
    currentRowText: curRow ? txt(curRow).slice(0, 160) : '',
    keyword: [...document.querySelectorAll('input')].map((i) => i.value).filter((v) => v && v.startsWith('GD-')),
  }
})
console.log('LIST_JUMP:', JSON.stringify(after, null, 2))
await shot('round-02-list-jump.png')
console.log('ROUND2_DONE')
