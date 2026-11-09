// round-04 — ①「选生产工单」弹窗提示新名 ②出货检验计划来源表格:无「不合格应对措施」+「检查频率」显示真实值
// 前置:测试库(浏览器当前工厂=YJ_TEST)已把草稿单 ZC-2026-10-0033 的产品编码临时改为 B-92-25(有 15 行含检测频率的计划)
const OUT = 'C:/Users/vigna/ego/qc-insp-rename-20261109'
const task = await taskSpace(29)
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
async function langOf() {
  return page.evaluate(() => ({ ls: localStorage.getItem('mes_locale'), htmlLang: document.documentElement.lang }))
}
/** 循环 Alt+L 直到中文 */
for (let i = 0; i < 14; i++) {
  const l = await langOf()
  if (String(l.htmlLang || '').startsWith('zh')) break
  await page.keyboard.press('Alt+l')
  await page.waitForTimeout(1200)
}
console.log('LANG ' + JSON.stringify(await langOf()))

await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(6000)
await restoreWindow()

const toolbar = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return [...document.querySelectorAll('.tb-main .act-name')].map(txt)
})
console.log('TOOLBAR ' + JSON.stringify(toolbar))

// ① 选生产工单弹窗
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-main .act-name')].find((e) => (e.textContent || '').includes('选生产工单'))
  if (!el) return false
  const main = el.closest('.tb-main')
  if (main) main.click()
  return true
})
console.log('clickedPicker=' + clicked)
await page.waitForTimeout(2500)
const picker = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const vis = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const d = vis[vis.length - 1]
  return {
    titles: vis.map((x) => txt(x.querySelector('.el-dialog__title'))),
    tips: [...(d?.querySelectorAll('.wopick-tip, .wopick-gate') || [])].map((x) => txt(x)),
    bodyHasOld: (d?.innerText || '').includes('制程检验单'),
    bodyHasNew: (d?.innerText || '').includes('出货检验单功能'),
    hasForceBtn: [...(d?.querySelectorAll('button') || [])].some((b) => (b.textContent || '').includes('强制开单')),
  }
})
console.log('WO_PICKER ' + JSON.stringify(picker, null, 2))
await page.screenshot({ path: OUT + '/r4-wo-picker.png' })
await page.keyboard.press('Escape')
await page.waitForTimeout(800)

// ② 点左栏草稿单 ZC-2026-10-0033,再打「带入检验项目」弹窗
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
  const row = rows.find((r) => (r.textContent || '').includes('ZC-2026-10-0033'))
  if (!row) return { ok: false, sample: rows.slice(0, 5).map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()) }
  row.click()
  return { ok: true }
})
console.log('railPick ' + JSON.stringify(picked))
await page.waitForTimeout(3500)
const headNow = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    docNo: txt(document.querySelector('.doc-chip')),
    productCodeInputs: [...document.querySelectorAll('.qr-head-table input')].map((i) => i.value).filter(Boolean).slice(0, 12),
    bandActs: [...document.querySelectorAll('.qr-band-act2')].map(txt),
  }
})
console.log('HEAD ' + JSON.stringify(headNow, null, 2))

const opened = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-band-act2')].find((e) => (e.textContent || '').includes('带入检验项目'))
  if (!el) return false
  el.click()
  return true
})
console.log('clickedBringItems=' + opened)
await page.waitForTimeout(3000)
const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const vis = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const d = vis[vis.length - 1]
  const headers = [...(d?.querySelectorAll('.el-table__header th .cell') || [])].map(txt)
  const rows = [...(d?.querySelectorAll('.el-table__body tbody tr') || [])].map((tr) => [...tr.querySelectorAll('td')].map(txt))
  return {
    dialogTitles: vis.map((x) => txt(x.querySelector('.el-dialog__title'))),
    headers,
    rowCount: rows.length,
    rowsSample: rows.slice(0, 4),
    freqCellsSample: rows.slice(0, 6).map((r) => r[5]),
    emptyText: txt(d?.querySelector('.el-table__empty-text')),
    headerHasForbidden: headers.some((h) => h.includes('不合格应对措施')),
    headerHasFreq: headers.some((h) => h.includes('检查频率')),
    bodyHasOldName: (d?.innerText || '').includes('制程检验单'),
  }
})
console.log('DIALOG ' + JSON.stringify(dlg, null, 2))
await page.screenshot({ path: OUT + '/r4-plan-dialog.png' })
console.log('DONE')
