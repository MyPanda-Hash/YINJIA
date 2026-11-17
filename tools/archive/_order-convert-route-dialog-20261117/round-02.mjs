// 复现第二步:跳到最近有数据的一天 → 勾选 1 行 → 选工艺路线并确定 → 再开弹窗点同一路线,读「确定」是否可点。
const task = await taskSpace('order-convert-route-dialog-20261117')
const page = task.page('p1')
const wait = (ms) => page.waitForTimeout(ms)

const helper = () => {
  const txt = (el) => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '')
  const btn = (t) => [...document.querySelectorAll('button')].find((b) => txt(b).includes(t))
  const dialog = () => [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null)
  const dlgTable = () => {
    const d = dialog()
    return d ? d.querySelector('.el-table__body-wrapper') : null
  }
  return { txt, btn, dialog, dlgTable }
}

// 1) 跳到最近有数据的一天
await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const b = [...document.querySelectorAll('button')].find((x) => txt(x).includes('跳到最近有数据的一天'))
  if (b) b.click()
})
await wait(5000)

const rowsState = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const table = document.querySelector('.oc-table')
  const trs = table ? [...table.querySelectorAll('.el-table__body-wrapper tbody tr')] : []
  return {
    rows: trs.length,
    first: trs[0] ? txt(trs[0]).slice(0, 120) : '',
    routeBtn: [...document.querySelectorAll('button')].map(txt).find((t) => t.startsWith('选择工艺路线')),
  }
})
console.log('ROWS', JSON.stringify(rowsState))

// 2) 点第一行(整行勾选)
await page.evaluate(() => {
  const table = document.querySelector('.oc-table')
  const tr = table && table.querySelector('.el-table__body-wrapper tbody tr')
  const cell = tr && tr.querySelectorAll('td')[1]
  if (cell) cell.click()
})
await wait(800)
console.log('AFTER_PICK_ROW', JSON.stringify(await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    routeBtn: [...document.querySelectorAll('button')].map(txt).find((t) => t.startsWith('选择工艺路线')),
    checked: document.querySelectorAll('.oc-table .el-table__body-wrapper .el-checkbox.is-checked').length,
  }
})))

// 3) 打开工艺路线弹窗
await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const b = [...document.querySelectorAll('button')].find((x) => txt(x).startsWith('选择工艺路线'))
  if (b) b.click()
})
await wait(1200)

const dlgInfo = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const trs = d ? [...d.querySelectorAll('.el-table__body-wrapper tbody tr')] : []
  const ok = d ? [...d.querySelectorAll('button')].find((b) => txt(b) === '确定') : null
  return {
    dialogTitle: d ? txt(d.querySelector('.el-dialog__title')) : null,
    rowCount: trs.length,
    rows: trs.slice(0, 6).map((tr, i) => ({ i, text: txt(tr).slice(0, 60), current: tr.className })),
    okDisabled: ok ? ok.disabled : null,
  }
})
console.log('DIALOG', JSON.stringify(dlgInfo, null, 2))

// 4) 点第一条路线 → 确定可用?
await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const tr = d.querySelector('.el-table__body-wrapper tbody tr')
  const cell = tr.querySelectorAll('td')[1]
  cell.click()
})
await wait(600)
const afterPick = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const ok = [...d.querySelectorAll('button')].find((b) => txt(b) === '确定')
  const cur = d.querySelector('.el-table__body-wrapper tbody tr.current-row')
  return { okDisabled: ok.disabled, currentRowText: cur ? txt(cur).slice(0, 50) : null }
})
console.log('AFTER_PICK_FIRST', JSON.stringify(afterPick))

// 5) 点确定(应用到行) → 弹窗关闭
await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const ok = [...d.querySelectorAll('button')].find((b) => txt(b) === '确定')
  if (ok && !ok.disabled) ok.click()
})
await wait(1200)
console.log('AFTER_APPLY', JSON.stringify(await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return { dialogStillOpen: !!d, msg: txt(document.querySelector('.el-message') || {}) }
})))

// 6) 再次打开弹窗(同一行仍勾着)
await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const b = [...document.querySelectorAll('button')].find((x) => txt(x).startsWith('选择工艺路线'))
  if (b) b.click()
})
await wait(1200)
const reopen = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const trs = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const ok = [...d.querySelectorAll('button')].find((b) => txt(b) === '确定')
  return {
    okDisabled: ok.disabled,
    currentRows: trs.filter((tr) => tr.className.includes('current-row')).map((tr) => txt(tr).slice(0, 50)),
  }
})
console.log('REOPEN', JSON.stringify(reopen, null, 2))

// 7) 再点"同一条"路线 → 确定是否可点(用户报障点)
await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const tr = d.querySelector('.el-table__body-wrapper tbody tr')
  tr.querySelectorAll('td')[1].click()
})
await wait(600)
const clickSame = await page.evaluate(() => {
  const txt = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const ok = [...d.querySelectorAll('button')].find((b) => txt(b) === '确定')
  const trs = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')]
  return {
    okDisabled: ok.disabled,
    currentRows: trs.filter((tr) => tr.className.includes('current-row')).map((tr) => txt(tr).slice(0, 50)),
  }
})
console.log('CLICK_SAME_ROW', JSON.stringify(clickSame, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await wait(300)
} catch (e) {
  console.log('restore skip: ' + e.message)
}
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_order-convert-route-dialog-20261117/repro-02-dialog.png' })
console.log('SHOT ok')
