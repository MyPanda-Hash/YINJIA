// round-19: 必填红星回来 + 必填没填点「提交审批」被拦(正式库真实草稿 IJ-2026-10-0020)
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
const BASE = 'http://localhost:5173'
const DOC = 'IJ-2026-10-0020'

await page.goto(`${BASE}/#/panelx/list/QC_INSP`, { timeout: 30000 })
await page.waitForTimeout(4000)
const need = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('登录账号')))
if (need) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('登录账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('登录密码')), '123456')
  })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))?.click())
  await page.waitForTimeout(6000)
  await page.goto(`${BASE}/#/panelx/list/QC_INSP`, { timeout: 30000 })
}
await page.reload({ timeout: 30000 })
await page.waitForTimeout(9000)
console.log('账套 =', await page.evaluate(() => (document.querySelector('.factory .factory-name')?.textContent || '').trim()))

// 打开那张草稿
const opened = await page.evaluate((doc) => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  const hit = rows.find((tr) => (tr.textContent || '').includes(doc))
  if (hit) { (hit.querySelector('td') || hit).click(); return true }
  if (rows.length) { (rows[0].querySelector('td') || rows[0]).click(); return '首行' }
  return false
}, DOC)
console.log('打开单据 =', opened)
await page.waitForTimeout(5000)

// 必填红星是否画出来(取 ::before 的 content)
const stars = await page.evaluate(() => {
  const pick = (sel) => [...document.querySelectorAll(sel)].map((el) => ({
    text: (el.textContent || '').trim(),
    before: getComputedStyle(el, '::before').content,
    after: getComputedStyle(el, '::after').content,
  }))
  return {
    headerNo: [...document.querySelectorAll('input')].map((i) => i.value).find((v) => String(v).startsWith('IJ-')),
    colHeaders: pick('.col-hdr-text.req'),
    fieldLabels: pick('.field label.req'),
  }
})
console.log('必填红星 =', JSON.stringify(stars, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-19-stars.png' })

// 找「提交审批」:先直接找可见项,找不到就展开「审批」下拉
async function dumpApprovalItems() {
  return page.evaluate(() => [...document.querySelectorAll('.tb-main, .act-name, .el-dropdown-menu__item, li, span, div')]
    .filter((e) => e.offsetParent !== null && /^提交审批$/.test((e.textContent || '').trim()))
    .map((e) => ({ tag: e.tagName, cls: e.className })))
}
let cands = await dumpApprovalItems()
console.log('提交审批候选(直接) =', JSON.stringify(cands))
if (!cands.length) {
  // 点开「审批」分组
  const clickedGroup = await page.evaluate(() => {
    const g = [...document.querySelectorAll('.tb-main, .tb-btn, button, .el-button, .act-name')]
      .find((e) => e.offsetParent !== null && /^审批/.test((e.textContent || '').trim()))
    if (!g) return false
    ;(g.closest('.tb-item, .tool-btn, button, div') || g).click()
    return true
  })
  console.log('展开审批分组 =', clickedGroup)
  await page.waitForTimeout(1200)
  cands = await dumpApprovalItems()
  console.log('提交审批候选(展开后) =', JSON.stringify(cands))
}
const clicked = await page.evaluate(() => {
  const it = [...document.querySelectorAll('.el-dropdown-menu__item, li, span, div')]
    .find((e) => e.offsetParent !== null && /^提交审批$/.test((e.textContent || '').trim()))
  if (!it) return false
  it.click()
  return true
})
console.log('点提交审批 =', clicked)
await page.waitForTimeout(3500)
// 可能有确认框
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box button')].find((x) => /确定|提交|确认/.test((x.textContent || '')))
  if (b) b.click()
})
await page.waitForTimeout(3000)
const after = await page.evaluate(() => ({
  messages: [...document.querySelectorAll('.el-message, .el-message-box__message, .el-notification__content')]
    .map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  status: [...document.querySelectorAll('.doc-tag, .status-tag, .tag')].map((e) => (e.textContent || '').trim()).filter(Boolean).slice(0, 4),
}))
console.log('提交审批结果 =', JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-19-submit-blocked.png' })
console.log('done round-19')
