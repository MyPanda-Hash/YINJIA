const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 第 7 张(末页)往后翻到 GY-003 草稿单 —— 用 ▶ 逐张翻到今天看到的草稿
for (let i = 0; i < 8; i++) {
  const info = await page.evaluate(() => ({
    doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
    status: (document.querySelector('.doc-status')?.textContent || '').trim(),
    pageNo: (document.querySelector('.page-no')?.textContent || '').trim(),
  }))
  if (info.status.includes('草稿')) { console.log('found draft:', JSON.stringify(info)); break }
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.page-btn')].find((x) => (x.textContent || '').includes('▶'))
    if (b) b.click()
  })
  await page.waitForTimeout(1600)
}

console.log(JSON.stringify(await page.evaluate(() => ({
  doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  status: (document.querySelector('.doc-status')?.textContent || '').trim(),
  headValues: [...document.querySelectorAll('.fields .field')].map((f) => ({
    code: f.dataset.code, value: f.querySelector('input')?.value ?? '',
  })).filter((x) => ['工艺路线编码', '工艺路线名称', '生效日期', '失效日期'].includes(x.code)),
  rows: [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 5).map((tr) => [...tr.querySelectorAll('td')].slice(0, 6).map((td) => (td.innerText || '').trim())),
})), null, 2))

// 点「保存」
const clicked = await page.evaluate(() => {
  const s = [...document.querySelectorAll('.tools .act-name')].find((x) => (x.textContent || '').trim() === '保存')
  if (s) { s.click(); return true } return false
})
console.log('saveClicked:', clicked)
await page.waitForTimeout(2500)

console.log(JSON.stringify(await page.evaluate(() => ({
  dialogTitle: (document.querySelector('.el-message-box__title')?.textContent || '').trim(),
  dialogItems: [...document.querySelectorAll('.el-message-box__message li')].map((li) => (li.textContent || '').trim()),
  headBlink: [...document.querySelectorAll('.fields .field.field-blink')].map((f) => f.dataset.code),
  cellBlink: document.querySelectorAll('.cell-blink').length,
  rowMissing: [...document.querySelectorAll('.el-table__row.row-missing-hint')].map((tr) => [...tr.querySelectorAll('td')].slice(0, 6).map((td) => (td.innerText || '').trim())),
})), null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-08-popup.png' })
