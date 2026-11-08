// round-05 — 定位纸面面板侧栏按钮 + 读当前单头四列值 + 选生产工单提示 + 计划来源表格有多少行
const OUT = 'C:/Users/vigna/ego/qc-insp-rename-20261109'
const task = await taskSpace(29)
const page = task.page('p1')

const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    htmlLang: document.documentElement.lang,
    docChips: [...document.querySelectorAll('.doc-chip')].map(txt),
    sideBtns: [...document.querySelectorAll('.as-side-btn')].map(txt).filter(Boolean),
    headTableInputs: [...document.querySelectorAll('.qr-head-table input')].map((i) => i.value),
    gridHeadInputs: [...document.querySelectorAll('.qr-grid thead input')].map((i) => i.value),
    gridHeadTexts: [...document.querySelectorAll('.qr-grid thead th')].map(txt).filter(Boolean).slice(0, 14),
    dialogsOpen: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => txt(d.querySelector('.el-dialog__title'))),
  }
})
console.log('INFO ' + JSON.stringify(info, null, 2))

// 侧栏「选生产工单」
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').includes('选生产工单'))
  if (!el) return false
  el.click()
  return true
})
console.log('clickedSidePicker=' + clicked)
await page.waitForTimeout(2500)
const picker = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const vis = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const d = vis[vis.length - 1]
  return {
    titles: vis.map((x) => txt(x.querySelector('.el-dialog__title'))),
    tips: [...(d?.querySelectorAll('.wopick-tip, .wopick-gate') || [])].map(txt),
    bodyHasOld: (d?.innerText || '').includes('制程检验单'),
    bodyHasNew: (d?.innerText || '').includes('出货检验单功能'),
  }
})
console.log('WO_PICKER ' + JSON.stringify(picker, null, 2))
await page.screenshot({ path: OUT + '/r5-wo-picker.png' })
await page.keyboard.press('Escape')
await page.waitForTimeout(700)

// 再打「带入检验项目」:看行数与检查频率列
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-band-act2')].find((e) => (e.textContent || '').includes('带入检验项目'))
  if (el) el.click()
})
await page.waitForTimeout(3200)
const dlg = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const vis = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const d = vis[vis.length - 1]
  const headers = [...(d?.querySelectorAll('.el-table__header th .cell') || [])].map(txt)
  const rows = [...(d?.querySelectorAll('.el-table__body tbody tr') || [])].map((tr) => [...tr.querySelectorAll('td')].map(txt))
  return {
    headers, rowCount: rows.length, rowsSample: rows.slice(0, 3),
    freqCells: rows.slice(0, 6).map((r) => r[5]),
    emptyText: txt(d?.querySelector('.el-table__empty-text')),
  }
})
console.log('DIALOG ' + JSON.stringify(dlg, null, 2))
await page.screenshot({ path: OUT + '/r5-plan-dialog.png' })
console.log('DONE')
