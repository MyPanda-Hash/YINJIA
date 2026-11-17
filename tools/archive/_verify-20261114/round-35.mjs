// round-35 — 只读态续:处理「未保存提示」后打开已审核单 XJ-2026-11-0001
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
async function normalWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}
const dlg0 = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return d ? (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100) : null
})
console.log('DIALOG0=' + JSON.stringify(dlg0))
if (dlg0 && dlg0.includes('未保存')) {
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    const b = d && [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '不保存')
    if (b) b.click()
  })
  await page.waitForTimeout(6000)
}
// 再点 XJ-2026-11-0001
const open = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const tr = [...document.querySelectorAll('.dsr-grid tbody tr')].find((x) => txt(x).includes('XJ-2026-11-0001'))
  if (tr) tr.click()
  return !!tr
})
console.log('OPEN=' + open)
await page.waitForTimeout(7000)
const dlg1 = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  return d ? (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) : null
})
console.log('DIALOG1=' + JSON.stringify(dlg1))
if (dlg1 && dlg1.includes('未保存')) {
  await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    const b = d && [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '不保存')
    if (b) b.click()
  })
  await page.waitForTimeout(7000)
}
const st = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const active = document.querySelector('.dsr-grid tbody tr.active')
  return {
    activeRow: txt(active),
    editing: !!document.querySelector('.lp-sheet.is-editing'),
    inputs: document.querySelectorAll('.lp-grid input').length,
    statusTag: txt(active && active.querySelector('.dsr-tag')),
    cellText: txt(document.querySelector('.lp-block[data-lp="巡线时间"]')),
    v1: txt(document.querySelector('.lp-prod[data-lp="编号1"]')),
    vLen: txt(document.querySelector('.lp-prod[data-lp="长度实测1"]')),
    vPerson: txt(document.querySelector('.lp-block[data-lp="巡线人员"]')),
    rowspan4: [...document.querySelectorAll('[rowspan="4"]')].length,
    headers: [...document.querySelectorAll('.lp-grid thead th')].length,
  }
})
console.log('READONLY=' + JSON.stringify(st, null, 1))
await normalWin()
await page.screenshot({ path: OUT + '/round-35-patrol-readonly.png', fullPage: true })
await fs.writeFile(OUT + '/b-readonly.json', JSON.stringify({ dlg0, open, dlg1, st }, null, 1), 'utf8')
console.log('DONE round-35')
