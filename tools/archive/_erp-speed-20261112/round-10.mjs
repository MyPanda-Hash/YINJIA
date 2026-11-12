/**
 * 第 10 轮 · 弃审确认框取证(2026-11-12)
 * 当前选中单 = CGRK-20261014-03407(已审核 + 已转ERP,库里有 ERP单号)。
 *   「弃审」在工具栏「审批」这个组的下拉里 ⇒ 先点组尾的 ▼,再点下拉项「弃审」。
 *   只截图确认框,然后 **点取消**,不真的弃审。
 */
const OUT = 'C:/Users/Lenovo/ego/erp-dedup-20261112'
const task = await taskSpace('erp-dedup-20261112')
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

console.log('当前单据 =', await page.evaluate(() => {
  const chip = document.querySelector('.doc-chip')
  const st = document.querySelector('.doc-status')
  return { chip: chip ? chip.textContent.trim() : '', status: st ? st.textContent.trim() : '' }
}))

// 打开「审批」组下拉
const opened = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tb-group')]
  const g = groups.find((el) => (el.querySelector('.tb-main') || {}).textContent?.trim() === '审批')
  if (!g) return 'no-approve-group:' + groups.map((x) => ((x.querySelector('.tb-main') || {}).textContent || '').trim()).join('|')
  const caret = g.querySelector('.tb-caret')
  if (caret) { caret.click(); return true }
  return 'no-caret'
})
console.log('打开审批组 =', opened)
await page.waitForTimeout(800)
console.log('下拉项 =', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('.tb-menu .ctx-item')].map((x) => (x.textContent || '').trim()))))

// 点「弃审」
const clicked = await page.evaluate(() => {
  const item = [...document.querySelectorAll('.tb-menu .ctx-item')].find((x) => (x.textContent || '').trim() === '弃审')
  if (!item) return 'no-unaudit-item'
  item.click()
  return true
})
console.log('点弃审 =', clicked)
await page.waitForTimeout(1800)

const box = await page.evaluate(() => {
  const b = document.querySelector('.el-message-box')
  const m = document.querySelector('.el-message')
  return {
    box: b ? {
      title: ((b.querySelector('.el-message-box__title') || {}).textContent || '').trim(),
      content: ((b.querySelector('.el-message-box__message') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    } : null,
    toast: m ? (m.textContent || '').replace(/\s+/g, ' ').trim() : '',
  }
})
console.log('确认框 =', JSON.stringify(box, null, 2))
await restoreWindow()
await page.screenshot({ path: `${OUT}/round-10-unaudit-confirm.png` })

// 取消
console.log('取消 =', await page.evaluate(() => {
  const b = document.querySelector('.el-message-box')
  if (!b) return 'no-box'
  const btn = [...b.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '取消')
  if (btn) { btn.click(); return true }
  return 'no-cancel'
}))
await page.waitForTimeout(600)
